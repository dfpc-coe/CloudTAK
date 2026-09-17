import { Static, Type } from '@sinclair/typebox';
import Schema from '@openaddresses/batch-schema';
import { GenerateUpsert } from '@openaddresses/batch-generic';
import Err from '@openaddresses/batch-error';
import { CoTParser, Feature } from '@tak-ps/node-cot';
import Auth, { AuthResourceAccess } from '../../common/auth.js';
import Mapping from '../../common/mapping.js';
import { ConnectionFeature } from '../../common/schema.js';
import SubmitControl from '../lib/control/submit.js';
import type ConfigStateless from '../config.js';

const SubmitFeature = Type.Object({
    id: Type.Optional(Type.String()),
    type: Type.Literal('Feature'),
    path: Type.Optional(Type.String()),
    properties: Feature.InputProperties,
    geometry: Type.Optional(Type.Union([Type.Null(), Feature.Geometry], {
        description: 'Features without a geometry cannot be delivered as CoT or mapped to a CoreEvent but can still be mapped to a CoreDevice',
    })),
});

const SubmitError = Type.Object({
    error: Type.String(),
    feature: SubmitFeature,
});

const SubmitSkipped = Type.Object({
    reason: Type.String(),
    feature: SubmitFeature,
});

const ConnectionSubmitResponse = Type.Object({
    status: Type.Integer(),
    message: Type.String(),
    submitted: Type.Integer({ description: 'Number of Features delivered as CoT' }),
    events: Type.Integer({ description: 'Number of CoreEvents created or updated by CoreEvent Maps' }),
    devices: Type.Integer({ description: 'Number of CoreDevices created or updated by CoreDevice Maps' }),
    errors: Type.Array(SubmitError),
    skipped: Type.Array(SubmitSkipped),
});

export default async function router(schema: Schema, config: ConfigStateless) {
    const control = new SubmitControl(config);

    await schema.post('/connection/:connectionid/submit', {
        name: 'Submit Features',
        group: 'Connection',
        description: 'Submit a GeoJSON-like FeatureCollection conforming to a named Output schema to a Connection - the Layer Maps for that schema style Features delivered to the TAK Server as CoT (CoreFeature) and create or update CoreEvents & CoreDevices',
        params: Type.Object({
            connectionid: Type.Integer({ minimum: 1 }),
        }),
        query: Type.Object({
            archive: Type.Boolean({
                description: 'Save delivered Features to the ConnectionFeature table',
                default: true,
            }),
        }),
        body: Type.Object({
            type: Type.Literal('FeatureCollection'),
            schema: Type.String({ minLength: 1, description: 'Named Output schema of the Task the Features conform to' }),
            uids: Type.Optional(Type.Array(Type.String(), {
                description: 'IDs of every Feature in the full submission, including Features in other posts of a batched submission - reserved for mission diff support',
            })),
            features: Type.Array(SubmitFeature),
        }),
        res: ConnectionSubmitResponse,
    }, async (req, res) => {
        const errors: Array<Static<typeof SubmitError>> = [];
        const skipped: Array<Static<typeof SubmitSkipped>> = [];
        let events = 0;
        let devices = 0;

        try {
            const { connection, layer } = await Auth.is_connection(config, req, {
                resources: [
                    { access: AuthResourceAccess.CONNECTION, id: req.params.connectionid },
                    { access: AuthResourceAccess.LAYER },
                ],
            }, req.params.connectionid);

            if (!req.headers['content-type']) throw new Err(400, null, 'Content-Type not set');
            if (connection.readonly) throw new Err(400, null, 'Connection is Read-Only mode');

            const incoming = layer ? (await config.models.Layer.augmented_from(layer.id)).incoming : undefined;
            const mapping = incoming ? new Mapping(incoming.maps, req.body.schema) : undefined;

            const cots = [];

            for (const feature of req.body.features) {
                const feat = { ...feature, properties: feature.properties ?? {} };
                let mapped = false;

                if (mapping) {
                    try {
                        const event = await mapping.event(feat);
                        if (event) {
                            await control.event(connection.id, feat, event);
                            events++;
                            mapped = true;
                        }
                    } catch (err) {
                        errors.push({ error: err instanceof Error ? err.message : String(err), feature: feat });
                    }

                    try {
                        const device = await mapping.device(feat);
                        if (device) {
                            await control.device(connection.id, feat, device);
                            devices++;
                            mapped = true;
                        }
                    } catch (err) {
                        errors.push({ error: err instanceof Error ? err.message : String(err), feature: feat });
                    }
                }

                if (!feature.geometry) {
                    if (!mapped) skipped.push({ reason: 'Feature has no geometry', feature });
                    continue;
                }

                const geom = { ...feat, geometry: feature.geometry };

                try {
                    const styled = mapping ? await mapping.feature(geom) : geom;

                    if (!styled.properties.flow) styled.properties.flow = {};
                    styled.properties.flow[`CloudTAK-Connection-${connection.id}`] = new Date().toISOString();
                    if (layer) styled.properties.flow[`CloudTAK-Layer-${layer.id}`] = new Date().toISOString();

                    cots.push(await CoTParser.from_geojson(styled));
                } catch (err) {
                    errors.push({ error: err instanceof Error ? err.message : String(err), feature: geom });
                }
            }

            if (!cots.length) {
                res.status(errors.length ? 400 : 200).json({
                    status: errors.length ? 400 : 200,
                    message: events || devices ? 'Submitted' : 'No features found',
                    submitted: 0,
                    events,
                    devices,
                    errors,
                    skipped,
                });
                return;
            }

            if (!connection.enabled) throw new Err(200, null, 'Received but Connection Paused');

            const live = cots.filter(cot => !cot.is_stale());

            if (req.query.archive && live.length) {
                const insertValues = [];
                for (const cot of live) {
                    insertValues.push({
                        path: '/',
                        connection: connection.id,
                        layer: layer ? layer.id : null,
                        ...(await CoTParser.to_geojson(cot)),
                    });
                }

                try {
                    const INSERT_BATCH = 10000;
                    for (let i = 0; i < insertValues.length; i += INSERT_BATCH) {
                        await config.models.ConnectionFeature.generate(insertValues.slice(i, i + INSERT_BATCH), {
                            upsert: GenerateUpsert.UPDATE,
                            upsertTarget: [ConnectionFeature.connection, ConnectionFeature.id],
                        });
                    }
                } catch (err) {
                    console.error(err);
                }
            }

            await config.hub.submitCots({
                connection: connection.id,
                cots: live,
                broadcast: true,
            });

            res.status(errors.length ? 400 : 200).json({
                status: errors.length ? 400 : 200,
                message: 'Submitted',
                submitted: live.length,
                events,
                devices,
                errors,
                skipped,
            });
        } catch (err) {
            if (err instanceof Err && err.status === 200) {
                res.json({
                    status: 200,
                    message: err.message,
                    submitted: 0,
                    events,
                    devices,
                    errors,
                    skipped,
                });
            } else {
                Err.respond(err, res);
            }
        }
    });
}

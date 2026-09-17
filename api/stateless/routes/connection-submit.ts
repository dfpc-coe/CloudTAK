import { Static, Type } from '@sinclair/typebox';
import Schema from '@openaddresses/batch-schema';
import { GenericListOrder } from '@openaddresses/batch-generic';
import { eq, and } from 'drizzle-orm';
import Err from '@openaddresses/batch-error';
import { CoTParser, Feature } from '@tak-ps/node-cot';
import Auth, { AuthResourceAccess } from '../../common/auth.js';
import Mapping from '../../common/mapping.js';
import type { MappingRow } from '../../common/mapping.js';
import { LayerMapping } from '../../common/schema.js';
import { LayerMapping_Destination } from '../../common/enums.js';
import SubmitControl from '../lib/control/submit.js';
import { connectionChannels } from '../lib/tak-channels.js';
import { archiveCots } from '../lib/control/feature.js';
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

const RECORDS = [
    [LayerMapping_Destination.COREEVENT, 'event'],
    [LayerMapping_Destination.COREDEVICE, 'device'],
] as const;

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
    events: Type.Integer({ description: 'Number of CoreEvents created or updated by CoreEvent Mappings' }),
    devices: Type.Integer({ description: 'Number of CoreDevices created or updated by CoreDevice Mappings' }),
    errors: Type.Array(SubmitError),
    skipped: Type.Array(SubmitSkipped),
});

export default async function router(schema: Schema, config: ConfigStateless) {
    const control = new SubmitControl(config);

    await schema.post('/connection/:connectionid/submit', {
        name: 'Submit Features',
        group: 'Connection',
        description: 'Submit a GeoJSON-like FeatureCollection conforming to a named Output schema to a Connection - the Layer Mappings for that schema style Features delivered to the TAK Server as CoT (CoreFeature) and create or update CoreEvents & CoreDevices. Queries are mutually exclusive - per destination a Feature is converted by the first query it matches, falling back to the default Mapping',
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
            features: Type.Array(SubmitFeature),
        }),
        res: ConnectionSubmitResponse,
    }, async (req, res) => {
        const errors: Array<Static<typeof SubmitError>> = [];
        const skipped: Array<Static<typeof SubmitSkipped>> = [];
        const counts = { event: 0, device: 0 };

        const respond = (message: string, submitted = 0, status = errors.length ? 400 : 200) => {
            res.status(status).json({ status, message, submitted, events: counts.event, devices: counts.device, errors, skipped });
        };

        try {
            const { connection, layer } = await Auth.is_connection(config, req, {
                resources: [
                    { access: AuthResourceAccess.CONNECTION, id: req.params.connectionid },
                    { access: AuthResourceAccess.LAYER },
                ],
            }, req.params.connectionid);

            if (!req.headers['content-type']) throw new Err(400, null, 'Content-Type not set');
            if (connection.readonly) throw new Err(400, null, 'Connection is Read-Only mode');

            let rows: MappingRow[] = [];
            if (layer) {
                rows = (await config.models.LayerMapping.list({
                    limit: Number.MAX_SAFE_INTEGER,
                    order: GenericListOrder.ASC,
                    sort: 'id',
                    where: and(eq(LayerMapping.layer, layer.id), eq(LayerMapping.schema, req.body.schema)),
                })).items;
            }

            const mapping = new Mapping(rows);

            const cots = [];

            // Resolved at most once per submission & only when a Mapping defines no channels
            let inherited: Promise<number[]> | undefined;
            const inherit = () => inherited ??= connectionChannels(config, connection)
                .then(channels => Array.from(channels))
                .catch((err) => {
                    console.error(`not ok - failed to resolve the Channels of Connection ${connection.id}:`, err);
                    return [];
                });

            const features = req.body.features.map(feature => ({ ...feature, properties: feature.properties ?? {} }));
            const mapped = new Set<number>();

            // Every Event is persisted before the first Device so a Device can be assigned to an Event of the same submission
            for (const [destination, kind] of RECORDS) {
                for (const [i, feature] of features.entries()) {
                    try {
                        const row = await mapping.match(destination, feature);
                        if (!row) continue;

                        await control[kind](connection.id, feature, mapping.render(row, feature), { createOnly: Mapping.createOnly(row), inherit });
                        counts[kind]++;
                        mapped.add(i);
                    } catch (err) {
                        errors.push({ error: err instanceof Error ? err.message : String(err), feature });
                    }
                }
            }

            for (const [i, feature] of features.entries()) {
                if (!feature.geometry) {
                    if (!mapped.has(i)) skipped.push({ reason: 'Feature has no geometry', feature: req.body.features[i] });
                    continue;
                }

                const styled = { ...feature, geometry: feature.geometry };

                try {
                    const row = await mapping.match(LayerMapping_Destination.COREFEATURE, styled);
                    if (row) mapping.render(row, styled);

                    if (!styled.properties.flow) styled.properties.flow = {};
                    styled.properties.flow[`CloudTAK-Connection-${connection.id}`] = new Date().toISOString();
                    if (layer) styled.properties.flow[`CloudTAK-Layer-${layer.id}`] = new Date().toISOString();

                    cots.push(await CoTParser.from_geojson(styled));
                } catch (err) {
                    errors.push({ error: err instanceof Error ? err.message : String(err), feature: styled });
                }
            }

            if (!cots.length) return respond(counts.event || counts.device ? 'Submitted' : 'No features found');
            if (!connection.enabled) return respond('Received but Connection Paused', 0, 200);

            const live = cots.filter(cot => !cot.is_stale());

            if (req.query.archive) await archiveCots(config, live, connection.id, layer ? layer.id : null);

            await config.hub.submitCots({
                connection: connection.id,
                cots: live,
                broadcast: true,
            });

            respond('Submitted', live.length);
        } catch (err) {
            Err.respond(err, res);
        }
    });
}

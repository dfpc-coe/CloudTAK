import { Static, Type } from '@sinclair/typebox'
import Schema from '@openaddresses/batch-schema';
import crypto from 'node:crypto';
import Err from '@openaddresses/batch-error';
import { Item as QueueItem } from '../lib/queue.js'
import Cacher from '../lib/cacher.js';
import Auth, { AuthResourceAccess } from '../lib/auth.js';
import Style from '../lib/style.js';
import DDBQueue from '../lib/queue.js';
import Config from '../lib/config.js';
import CoT, { Feature } from '@tak-ps/node-cot';
import { MissionLayerType } from '../lib/api/mission-layer.js';
import { StandardLayerResponse, LayerError } from '../lib/types.js';
import TAKAPI, { APIAuthCertificate, } from '../lib/tak-api.js';

export default async function router(schema: Schema, config: Config) {
    const ddb = new DDBQueue(config.StackName);
    ddb.on('error', (err) => { console.error(err); });

    await schema.post('/layer/:layerid/cot', {
        name: 'Post COT',
        group: 'Internal',
        description: 'Post CoT data to a given layer',
        params: Type.Object({
            layerid: Type.Integer({ minimum: 1 })
        }),
        query: Type.Object({
            logging: Type.Optional(Type.Boolean({ "description": "If logging is enabled for the layer, allow callers to skip logging for a particular CoT payload" }))
        }),
        body: Type.Object({
            type: Type.Literal('FeatureCollection'),
            uids: Type.Optional(Type.Array(Type.String())),
            features: Type.Array(Feature.InputFeature)
        }),
        res: StandardLayerResponse
    }, async (req, res) => {
        try {
            await Auth.as_resource(config, req, {
                resources: [{ access: AuthResourceAccess.LAYER, id: req.params.layerid }]
            });

            if (!req.headers['content-type']) throw new Err(400, null, 'Content-Type not set');

            const layer = await config.cacher.get(Cacher.Miss(req.query, `layer-${req.params.layerid}`), async () => {
                return await config.models.Layer.from(req.params.layerid);
            });

            const style = new Style(layer);

            for (let i = 0; i < req.body.features.length; i++) {
                if (!req.body.features[i].properties) req.body.features[i].properties = {};

                req.body.features[i] = await style.feat(req.body.features[i])

                if (req.body.features[i].properties.flow === undefined) {
                    req.body.features[i].properties.flow = {};
                }

                // @ts-expect-error TS claims this could be undefined
                req.body.features[i].properties.flow[`CloudTAK-Layer-${req.params.layerid}`] = new Date().toISOString();
            }

            let pooledClient;
            let data;

            if (!layer.data) {
                pooledClient = await config.conns.get(layer.connection);
            } else if (layer.data) {
                data = await config.models.Data.from(layer.data);

                pooledClient = await config.conns.get(data.connection);
                if (!pooledClient) throw new Err(500, null, `Pooled Client for ${data.connection} not found in config`);
            }

            if (!pooledClient || !pooledClient.config || !pooledClient.config.enabled) {
                throw new Err(200, null, 'Recieved but Connection Paused');
            }

            const errors: Array<Static<typeof LayerError>> = [];
            let cots = [];
            for (const feat of req.body.features) {
                try {
                    cots.push(CoT.from_geojson(feat))
                } catch (err) {
                    errors.push({
                        error: err instanceof Error ? err.message : String(err),
                        feature: feat
                    })

                    console.error(`Failed to decode ${String(err)}: feature: ${JSON.stringify(feat)}`);
                }
            }

            if (layer.data && data) {
                if (!data.mission_sync) {
                    throw new Err(202, null, 'Recieved but Data Mission Sync Disabled');
                }

                if (data.mission_diff) {
                    if (!Array.isArray(req.body.uids)) {
                        throw new Err(400, null, 'uids Array must be present when submitting to DataSync with MissionDiff');
                    }

                    const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(pooledClient.config.auth.cert, pooledClient.config.auth.key));
                    // Once NodeJS supports Set.difference we can simplify this
                    const inputFeats = new Set(req.body.uids);

                    const features = await api.MissionLayer.latestFeats(
                        data.name,
                        `layer-${layer.id}`,
                        { token: data.mission_token || undefined }
                    );

                    for (const feat of features.values()) {
                        if (!inputFeats.has(String(feat.id))) {
                            /** TODO Add in 5.3 once MissionAPI supports t-x-d-d
                             *  const cot = new ForceDelete(String(feat.id));
                             *  cot.addDest({ mission: data.name, path: `layer-${layer.id}`, after: '' });
                             *  cots.push(cot);
                             */
                            await api.Mission.detachContents(
                                data.name,
                                { uid: String(feat.id) },
                                { token: data.mission_token || undefined }
                            );
                        }
                    }

                    const existMap: Map<string, Static<typeof Feature.Feature>> = new Map()
                    for (const feat of features) {
                        existMap.set(String(feat.id), feat);
                    }

                    const pathMap = await api.MissionLayer.listAsPathMap(
                        data.name,
                        { token: data.mission_token || undefined }
                    );

                    for (const cot of cots) {
                        if (cot.path === '/') continue;

                        const path = cot.path.split('/').filter((p) => !!p);

                        let pathMapEntryLast = pathMap.get(`/${encodeURIComponent(layer.name)}/`);
                        if (!pathMapEntryLast) continue;

                        const pathSegs = [];
                        for (const p of path) {
                            pathSegs.push(encodeURIComponent(p));

                            const currentPath = `/${encodeURIComponent(layer.name)}/${pathSegs.join('/')}/`;
                            const pathMapEntry = pathMap.get(currentPath);

                            if (!pathMapEntry) {
                                const missionLayer = await api.MissionLayer.create(
                                    data.name,
                                    {
                                        uid: `layer-${layer.id}-${crypto.randomUUID()}`,
                                        name: p,
                                        type: MissionLayerType.UID,
                                        parentUid: pathMapEntryLast.uid,
                                        creatorUid: `connection-${data.connection}-data-${data.id}`
                                    },
                                    { token: data.mission_token || undefined }
                                );

                                pathMap.set(currentPath, missionLayer.data);

                                pathMapEntryLast = missionLayer.data;
                            } else {
                                pathMapEntryLast = pathMapEntry;
                            }
                        }

                        cot.addDest({ mission: data.name, path: pathMapEntryLast.uid, after: '' });
                    }

                    cots = cots.filter((cot) => {
                        const exist = existMap.get(cot.uid());
                        if (exist && data.mission_diff) {
                            const b = CoT.from_geojson(exist);
                            // TODO: Check for path change
                            if (!cot.isDiff(b)) return false;
                        }

                        return true;
                    })
                } else {
                    for (const cot of cots) {
                        cot.addDest({ mission: data.name });
                    }
                }
            }

            if (cots.length === 0) {
                throw new Err(200, null, 'No features found');
            }

            pooledClient.tak.write(cots);

            config.conns.cots(pooledClient.config, cots);

            // TODO Only GeoJSON Features go to Dynamo, this should also store CoT XML
            if (layer.logging && req.query.logging !== false) {
                ddb.queue(req.body.features.map((feat) => {
                    const item: QueueItem = {
                        id: String(feat.id),
                        layer: layer.id,
                        type: feat.type,
                        properties: feat.properties,
                        geometry: feat.geometry
                    }

                    return item;
                }));
            }

            res.status(errors.length ? 400 : 200).json({
                status: errors.length ? 400 : 200,
                message: 'Submitted',
                errors
            });
        } catch (err) {
            if (err instanceof Err && err.status === 200) {
                res.json({
                    status: 200,
                    message: err.message,
                    errors: []
                });
            } else {
                Err.respond(err, res);
            }
        }
    });
}

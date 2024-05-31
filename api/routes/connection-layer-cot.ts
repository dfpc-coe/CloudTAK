import { Static, Type } from '@sinclair/typebox'
import Schema from '@openaddresses/batch-schema';
import { check } from '@placemarkio/check-geojson';
import Err from '@openaddresses/batch-error';
import { CoT } from '@tak-ps/node-tak';
import { Item as QueueItem } from '../lib/queue.js'
import Cacher from '../lib/cacher.js';
import Auth, { AuthResourceAccess } from '../lib/auth.js';
import Style from '../lib/style.js';
import DDBQueue from '../lib/queue.js';
import Config from '../lib/config.js';
import { Feature } from '@tak-ps/node-cot';
import { StandardResponse } from '../lib/types.js';
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
        body: Type.Any(),
        res: StandardResponse
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

            try {
                req.body = check(JSON.stringify(req.body));
            } catch (err) {
                throw new Err(400, null, err instanceof Error ? err.message : String(err));
            }

            for (let i = 0; i < req.body.features.length; i++) {
                req.body.features[i] = await style.feat(req.body.features[i])
            }

            let pooledClient;
            let data;
            const cots = [];
            if (!layer.data) {
                pooledClient = await config.conns.get(layer.connection);

                for (const feat of req.body.features) {
                    cots.push(CoT.from_geojson(feat))
                }
            } else if (layer.data) {
                data = await config.models.Data.from(layer.data);

                if (!data.mission_sync) {
                    return res.status(202).json({ status: 202, message: 'Recieved but Data Mission Sync Disabled' });
                }

                pooledClient = await config.conns.get(data.connection);

                if (data.mission_diff) {
                    if (!Array.isArray(req.body.uids)) throw new Err(400, null, 'uids Array must be present when submitting to DataSync with MissionDiff');

                    const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(pooledClient.config.auth.cert, pooledClient.config.auth.key));
                    // Once NodeJS supports Set.difference we can simplify this
                    const inputFeats = new Set(req.body.uids);
                    const features = await api.Mission.latestFeats(data.name, { token: data.mission_token });

                    for (const feat of features.values()) {
                        if (!inputFeats.has(String(feat.id))) {
                            await api.Mission.detachContents(
                                data.name,
                                { uid: String(feat.id) },
                                { token: data.mission_token }
                            );
                        }
                    }

                    const existMap: Map<string, Static<typeof Feature>> = new Map()
                    for (const feat of features) {
                        existMap.set(String(feat.id), feat);
                    }

                    for (const feat of req.body.features) {
                        const cot = CoT.from_geojson(feat);

                        const exist = existMap.get(String(feat.id));
                        if (exist && data.mission_diff) {
                            const b = CoT.from_geojson(exist);
                            if (!cot.isDiff(b)) continue;
                        }

                        cot.addDest({ mission: data.name });
                        cots.push(cot)
                    }
                } else {
                    for (const feat of req.body.features) {
                        const cot = CoT.from_geojson(feat);
                        cot.addDest({ mission: data.name });
                        cots.push(cot)
                    }
                }
            }

            if (!pooledClient || !pooledClient.config || !pooledClient.config.enabled) {
                return res.json({ status: 200, message: 'Recieved but Connection Paused' });
            }

            if (cots.length === 0) return res.json({ status: 200, message: 'No features found' });

            pooledClient.tak.write(cots);
            for (const cot of cots) config.conns.cot(pooledClient.config, cot);

            if (data) {
                const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(pooledClient.config.auth.cert, pooledClient.config.auth.key));
                await api.Mission.attachContents(data.name, {
                    uids: cots.map((cot) => { return cot.raw.event._attributes.uid })
                }, {
                    token: data.mission_token
                });
            }

            // TODO Only GeoJSON Features go to Dynamo, this should also store CoT XML
            if (layer.logging && req.query.logging !== false) ddb.queue(req.body.features.map((feat: Static<typeof Feature>) => {
                const item: QueueItem = {
                    id: String(feat.id),
                    layer: layer.id,
                    type: feat.type,
                    properties: feat.properties,
                    geometry: feat.geometry
                }

                return item;
            }));

            res.json({
                status: 200,
                message: 'Submitted'
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });
}

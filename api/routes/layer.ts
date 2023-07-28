import { check } from '@placemarkio/check-geojson';
import bodyparser from 'body-parser';
import Err from '@openaddresses/batch-error';
// @ts-ignore
import Layer from '../lib/types/layer.js';
// @ts-ignore
import Data from '../lib/types/data.js';
import CoT from '@tak-ps/node-cot';
import { Item as QueueItem } from '../lib/queue.js'
import Cacher from '../lib/cacher.js';
import { sql } from 'slonik';
import Auth from '../lib/auth.js';
import Lambda from '../lib/aws/lambda.js';
import CloudFormation from '../lib/aws/cloudformation.js';
import Style from '../lib/style.js';
import Alarm from '../lib/aws/alarm.js';
import DDBQueue from '../lib/queue.js';
import { Response } from 'express';
import { AuthRequest } from '@tak-ps/blueprint-login';
import Config from '../lib/config.js';
import Schedule from '../lib/schedule.js';
import S3 from '../lib/aws/s3.js';
import { Feature } from 'geojson';

export default async function router(schema: any, config: Config) {
    const alarm = new Alarm(config.StackName);
    const ddb = new DDBQueue(config.StackName);
    ddb.on('error', (err) => { console.error(err); });

    await schema.get('/layer', {
        name: 'List Layers',
        group: 'Layer',
        auth: 'user',
        description: 'List layers',
        query: 'req.query.ListLayers.json',
        res: 'res.ListLayers.json'
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(req);

            const list = await Layer.list(config.pool, req.query);

            if (config.StackName !== 'test') {
                const alarms = await alarm.list();

                list.layers.map((layer: any) => {
                    layer.status = alarms.get(layer.id) || 'unknown';
                });

                list.status = { healthy: 0, alarm: 0, unknown: 0 };
                for (const state of alarms.values()) {
                    list.status[state]++;
                }
            } else {
                list.status = { healthy: 0, alarm: 0, unknown: 0 };
                list.layers.map((layer: any) => {
                    layer.status = 'unknown';
                });
            }

            res.json(list);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.post('/layer', {
        name: 'Create Layer',
        group: 'Layer',
        auth: 'admin',
        description: 'Register a new layer',
        body: 'req.body.CreateLayer.json',
        res: 'res.Layer.json'
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(req);

            if (req.body.styles.queries) {
                req.body.styles = {
                    queries: req.body.styles.queries
                };
            } else {
                req.body.styles = {
                    point: req.body.styles.point,
                    line: req.body.styles.line,
                    polygon: req.body.styles.polygon
                };
            }

            if ((!req.body.connection && !req.body.data) || (req.body.connection && req.body.data)) {
                throw new Err(400, null, 'Either connection or data must be set');
            } else if (req.body.connection) {
                req.body.data = null;
            } else if (req.body.data) {
                req.body.connection = null;
            }

            Schedule.is_valid(req.body.cron);
            let layer = await Layer.generate(config.pool, req.body);

            if (!Schedule.is_aws(layer.cron) && layer.enabled) {
                config.events.add(layer.id, layer.cron);
            } else if (Schedule.is_aws(layer.cron) || !layer.enabled) {
                await config.events.delete(layer.id);
            }

            layer = layer.serialize();

            try {
                const lambda = await Lambda.generate(config, layer);
                await CloudFormation.create(config, layer.id, lambda);
            } catch (err) {
                console.error(err);
            }

            if (config.StackName !== 'test') {
                layer.status = await alarm.get(layer.id);
            } else {
                layer.status = 'unknown';
            }

            return res.json(layer);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.patch('/layer/:layerid', {
        name: 'Update Layer',
        group: 'Layer',
        auth: 'admin',
        description: 'Update a layer',
        ':layerid': 'integer',
        body: 'req.body.PatchLayer.json',
        res: 'res.Layer.json'
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(req);

            if (req.body.styles && req.body.styles.queries) {
                req.body.styles = {
                    queries: req.body.styles.queries
                };
            } else if (req.body.styles) {
                req.body.styles = {
                    point: req.body.styles.point,
                    line: req.body.styles.line,
                    polygon: req.body.styles.polygon
                };
            }

            if ((!req.body.connection && !req.body.data) || (req.body.connection && req.body.data)) {
                throw new Err(400, null, 'Either connection or data must be set');
            } else if (req.body.connection) {
                req.body.data = null;
            } else if (req.body.data) {
                req.body.connection = null;
            }

            if (req.body.cron) Schedule.is_valid(req.body.cron);

            let layer = await Layer.from(config.pool, parseInt(req.params.layerid));

            let changed = false;
            // Avoid Updating CF unless necessary as it blocks further updates until deployed
            for (const prop of ['cron', 'task', 'memory', 'timeout', 'enabled']) {
                if (req.body[prop] !== undefined && req.body[prop] !== layer[prop]) changed = true;
            }

            if (changed) {
                const status = (await CloudFormation.status(config, parseInt(req.params.layerid))).status;
                if (!status.endsWith('_COMPLETE')) throw new Err(400, null, 'Layer is still Deploying, Wait for Deploy to succeed before updating')
            }

            await layer.commit({ updated: sql`Now()`, ...req.body });

            if (changed) {
                try {
                    const lambda = await Lambda.generate(config, layer);
                    if (await CloudFormation.exists(config, layer.id)) {
                        await CloudFormation.update(config, layer.id, lambda);
                    } else {
                        await CloudFormation.create(config, layer.id, lambda);
                    }
                } catch (err) {
                    console.error(err);
                }
            }

            if (!Schedule.is_aws(layer.cron) && layer.enabled) {
                config.events.add(layer.id, layer.cron);
            } else if (Schedule.is_aws(layer.cron) || !layer.enabled) {
                await config.events.delete(layer.id);
            }

            layer = layer.serialize();

            await config.cacher.del(`layer-${req.params.layerid}`);

            if (config.StackName !== 'test') {
                layer.status = await alarm.get(layer.id);
            } else {
                layer.status = 'unknown';
            }

            return res.json(layer);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.get('/layer/:layerid', {
        name: 'Get Layer',
        group: 'Layer',
        auth: 'user',
        description: 'Get a layer',
        ':layerid': 'integer',
        res: 'res.Layer.json'
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(req);

            const layer = await config.cacher.get(Cacher.Miss(req.query, `layer-${req.params.layerid}`), async () => {
                return (await Layer.from(config.pool, req.params.layerid)).serialize();
            });

            if (config.StackName !== 'test') {
                layer.status = await alarm.get(layer.id);
            } else {
                layer.status = 'unknown';
            }

            return res.json(layer);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.delete('/layer/:layerid', {
        name: 'Delete Layer',
        group: 'Layer',
        auth: 'user',
        description: 'Delete a layer',
        ':layerid': 'integer',
        res: 'res.Standard.json'
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(req);

            const layer = await Layer.from(config.pool, req.params.layerid);

            await CloudFormation.delete(config, layer.id);

            config.events.delete(layer.id);

            await layer.delete();

            await config.cacher.del(`layer-${req.params.layerid}`);

            return res.json({
                status: 200,
                message: 'Layer Deleted'
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.post('/layer/:layerid/cot', {
        name: 'Post COT',
        group: 'Layer',
        auth: 'admin',
        description: 'Post CoT data to a given layer',
        ':layerid': 'integer',
        query: 'req.query.PostCoT.json',
        res: 'res.Standard.json'
    }, bodyparser.raw({
        type: '*/*',
        limit: '50mb'
    }), async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_layer(req, parseInt(req.params.layerid));

            if (!req.headers['content-type']) throw new Err(400, null, 'Content-Type not set');

            const layer = await config.cacher.get(Cacher.Miss(req.query, `layer-${req.params.layerid}`), async () => {
                return (await Layer.from(config.pool, req.params.layerid)).serialize();
            });

            const style = new Style(layer);
            req.body = String(req.body);

            if (req.headers['content-type'] === 'application/json') {
                try {
                    req.body = check(req.body);
                } catch (err) {
                    throw new Err(400, null, err.message);
                }

                for (let i = 0; i < req.body.features.length; i++) {
                    req.body.features[i] = await style.feat(req.body.features[i])
                }
            }

            if (layer.connection) {
                const pooledClient = await config.conns.get(layer.connection);

                if (!pooledClient || !pooledClient.conn || !pooledClient.conn.enabled) {
                    return res.json({
                        status: 200,
                        message: 'Recieved but Connection Paused'
                    });
                }

                if (req.headers['content-type'] === 'application/json') {
                    const cots = [];
                    for (const feat of req.body.features) {
                        cots.push(CoT.from_geojson(feat))
                    }

                    if (cots.length === 0) {
                        return res.json({ status: 200, message: 'No features found' });
                    }

                    pooledClient.tak.write(cots);

                    // TODO Only GeoJSON Features go to Dynamo, this should also store CoT XML
                    // @ts-ignore
                    if (layer.logging && req.query.logging !== false) ddb.queue(req.body.features.map((feat: Feature) => {
                        const item: QueueItem = {
                            id: String(feat.id),
                            layer: layer.id,
                            type: feat.type,
                            properties: feat.properties,
                            geometry: feat.geometry
                        }

                        return item;
                    }));
                } else if (req.headers['content-type'] === 'application/xml') {
                    pooledClient.tak.write_xml(req.body);
                } else {
                    throw new Err(400, null, 'Unsupported Content-Type');
                }
            } else if (layer.data) {
                if (req.headers['content-type'] === 'application/json') {
                    const data = await Data.from(config.pool, layer.data);
                    S3.put(`data/${data.id}/layer-${layer.id}.geojson`, JSON.stringify(req.body));
                } else {
                    throw new Err(400, null, 'Only Content-Type application/json is currently supported');
                }
            } else {
                throw new Err(400, null, 'Either connection or data must be set');
            }

            res.json({
                status: 200,
                message: 'Submitted'
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });

}

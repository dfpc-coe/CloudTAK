import Err from '@openaddresses/batch-error';
// @ts-ignore
import Layer from '../lib/types/layer.js';
// @ts-ignore
import LayerLive from '../lib/types/layers_live.js';
// @ts-ignore
import LayerFile from '../lib/types/layers_file.js';
import { XML as COT } from '@tak-ps/node-cot';
import Cacher from '../lib/cacher.js';
import { sql } from 'slonik';
import Auth from '../lib/auth.js';
import Lambda from '../lib/aws/lambda.js';
import CloudFormation from '../lib/aws/cloudformation.js';
import Style from '../lib/style.js';
import { check } from '@placemarkio/check-geojson';
import Alarm from '../lib/aws/alarm.js';
import DDBQueue from '../lib/queue.js';
import { Request, Response } from 'express';
import Config from '../lib/config.js';
import Schedule from '../lib/schedule.js';

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
    }, async (req: Request, res: Response) => {
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
    }, async (req: Request, res: Response) => {
        try {
            await Auth.is_auth(req);

            const data = req.body.data;
            delete req.body.data;

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

            let layer = await Layer.generate(config.pool, req.body);

            if (layer.mode === 'live') {
                Schedule.is_valid(data.cron);

                const layerdata = await LayerLive.generate(config.pool, {
                    layer_id: layer.id,
                    ...data
                });

                if (!Schedule.is_aws(layerdata.cron)) {
                    config.events.add(layer.id, layerdata.cron);
                } else {
                    await config.events.delete(layer.id);
                }
            } else if (layer.mode === 'file') {
                await LayerFile.generate(config.pool, {
                    layer_id: layer.id,
                    ...data
                });
            }

            layer = layer.serialize();
            layer.data = (layer.mode === 'file' ? await LayerFile.from(config.pool, layer.id, { column: 'layer_id' }) : await LayerLive.from(config.pool, layer.id, { column: 'layer_id' })).serialize();

            try {
                const lambda = await Lambda.generate(config, layer, data);
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
    }, async (req: Request, res: Response) => {
        try {
            await Auth.is_auth(req);

            const data = req.body.data;
            delete req.body.data;

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

            let layer = Object.keys(req.body).length > 0
                ?  await Layer.commit(config.pool, parseInt(req.params.layerid), {
                    updated: sql`Now()`,
                    ...req.body
                })
                :  await Layer.from(config.pool, parseInt(req.params.layerid));

            if (layer.mode === 'live') {
                if (data.cron) Schedule.is_valid(data.cron);

                const layerdata = await LayerLive.commit(config.pool, layer.id, data, {
                    column: 'layer_id'
                });

                try {
                    const lambda = await Lambda.generate(config, layer, layerdata);
                    if (await CloudFormation.exists(config, layer.id)) {
                        await CloudFormation.update(config, layer.id, lambda);
                    } else {
                        await CloudFormation.create(config, layer.id, lambda);
                    }
                } catch (err) {
                    console.error(err);
                }

                if (!Schedule.is_aws(layerdata.cron)) {
                    config.events.add(layer.id, layerdata.cron);
                } else {
                    await config.events.delete(layer.id);
                }
            } else if (layer.mode === 'file') {
                await LayerFile.commit(config.pool, layer.id, data, {
                    column: 'layer_id'
                });
            }

            layer = layer.serialize();
            layer.data = (layer.mode === 'file' ? await LayerFile.from(config.pool, layer.id, { column: 'layer_id' }) : await LayerLive.from(config.pool, layer.id, { column: 'layer_id' })).serialize();

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
    }, async (req: Request, res: Response) => {
        try {
            await Auth.is_auth(req);

            const layer = await config.cacher.get(Cacher.Miss(req.query, `layer-${req.params.layerid}`), async () => {
                const layer = (await Layer.from(config.pool, req.params.layerid)).serialize();
                layer.data = (layer.mode === 'file' ? await LayerFile.from(config.pool, layer.id, { column: 'layer_id' }) : await LayerLive.from(config.pool, layer.id, { column: 'layer_id' })).serialize();
                return layer;
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
    }, async (req: Request, res: Response) => {
        try {
            await Auth.is_auth(req);

            const layer = await Layer.from(config.pool, req.params.layerid);

            await CloudFormation.delete(config, layer.id);

            if (layer.mode === 'live') {
                await LayerLive.delete(config.pool, layer.id);
                config.events.delete(layer.id);
            } else if (layer.mode === 'file') {
                await LayerFile.delete(config.pool, layer.id);
            }

            await layer.delete();

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
        res: 'res.Standard.json'
    }, async (req: Request, res: Response) => {
        try {
            await Auth.is_layer(req, parseInt(req.params.layerid));

            if (!req.headers['content-type']) throw new Err(400, null, 'Content-Type not set');

            const layer = await config.cacher.get(Cacher.Miss(req.query, `layer-${req.params.layerid}`), async () => {
                const layer = (await Layer.from(config.pool, req.params.layerid)).serialize();
                layer.data = (layer.mode === 'file' ? await LayerFile.from(config.pool, layer.id, { column: 'layer_id' }) : await LayerLive.from(config.pool, layer.id, { column: 'layer_id' })).serialize();
                return layer;
            });

            if (layer.mode !== 'live') throw new Err(400, null, 'Cannot post CoT to file layer');

            const pooledClient = await config.conns.get(layer.data.connection);

            const style = new Style(layer);

            if (req.headers['content-type'] === 'application/json') {
                try {
                    // https://github.com/placemark/check-geojson/issues/17
                    req.body = check(JSON.stringify(req.body));
                } catch (err) {
                    throw new Err(400, null, err.message);
                }

                const features: any[] = new Array();
                for (const feat of req.body.features) {
                    const cot = COT.from_geojson(await style.feat(feat));

                    if (pooledClient.conn.enabled) {
                        pooledClient.tak.write(cot);
                    }

                    features.push(cot.to_geojson());
                }

                // TODO Only GeoJSON Features go to Dynamo, this should also store CoT XML
                if (layer.logging) ddb.queue(layer.id, features);
            } else if (req.headers['content-type'] === 'application/xml') {
                if (pooledClient.conn.enabled) {
                    pooledClient.tak.write(new COT(req.body));
                }
            } else {
                throw new Err(400, null, 'Unsupported Content-Type');
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

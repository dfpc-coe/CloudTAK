import Err from '@openaddresses/batch-error';
import Layer from '../lib/types/layer.js';
import LayerLive from '../lib/types/layers_live.js';
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
import DDBQueue from '../lib/queue.ts';

export default async function router(schema, config) {
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
    }, async (req, res) => {
        try {
            await Auth.is_auth(req);

            const list = await Layer.list(config.pool, req.query);

            if (config.StackName !== 'test') {
                const alarms = await alarm.list();

                list.layers.map((layer) => {
                    layer.status = alarms.get(layer.id) || 'unknown';
                });

                list.status = { healthy: 0, alarm: 0, unknown: 0 };
                for (const state of alarms.values()) {
                    list.status[state]++;
                }
            } else {
                list.status = { healthy: 0, alarm: 0, unknown: 0 };
                list.layers.map((layer) => {
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
    }, async (req, res) => {
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
                await LayerLive.generate(config.pool, {
                    layer_id: layer.id,
                    ...data
                });
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
                await CloudFormation.create(config, layer, lambda);
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
    }, async (req, res) => {
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
                ?  await Layer.commit(config.pool, req.params.layerid, {
                    updated: sql`Now()`,
                    ...req.body
                })
                :  await Layer.from(config.pool, req.params.layerid);

            if (layer.mode === 'live') {
                await LayerLive.commit(config.pool, layer.id, data, {
                    column: 'layer_id'
                });


                // TODO Update CF properties if they change
            } else if (layer.mode === 'file') {
                await LayerFile.commit(config.pool, layer.id, data, {
                    column: 'layer_id'
                });
            }

            try {
                const lambda = await Lambda.generate(config, layer, data);
                if (await CloudFormation.exists(config, layer)) {
                    await CloudFormation.update(config, layer, lambda);
                } else {
                    await CloudFormation.create(config, layer, lambda);
                }
            } catch (err) {
                console.error(err);
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
    }, async (req, res) => {
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
    }, async (req, res) => {
        try {
            await Auth.is_auth(req);

            const layer = await Layer.from(config.pool, req.params.layerid);

            await CloudFormation.delete(config, layer);

            if (layer.mode === 'live') {
                await LayerLive.delete(config.pool, layer.id);
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
    }, async (req, res) => {
        try {
            await Auth.is_layer(req, req.params.layerid);

            if (!req.headers['content-type']) throw new Err(400, null, 'Content-Type not set');

            const layer = await config.cacher.get(Cacher.Miss(req.query, `layer-${req.params.layerid}`), async () => {
                const layer = (await Layer.from(config.pool, req.params.layerid)).serialize();
                layer.data = (layer.mode === 'file' ? await LayerFile.from(config.pool, layer.id, { column: 'layer_id' }) : await LayerLive.from(config.pool, layer.id, { column: 'layer_id' })).serialize();
                return layer;
            });

            if (layer.mode !== 'live') throw new Err(400, null, 'Cannot post CoT to file layer');

            const conn = await config.conns.get(layer.data.connection);

            const style = new Style(layer);

            if (req.headers['content-type'] === 'application/json') {
                try {
                    // https://github.com/placemark/check-geojson/issues/17
                    req.body = check(JSON.stringify(req.body));
                } catch (err) {
                    throw new Err(400, null, err.message);
                }

                for (const feature of req.body.features) {
                    // TODO Only GeoJSON Features go to Dynamo, this should also store CoT XML
                    conn.tak.write(COT.from_geojson(await style.feat(feature)));
                }

                // TODO Only GeoJSON Features go to Dynamo, this should also store CoT XML
                ddb.put(layer.id, req.body.features);
            } else if (req.headers['content-type'] === 'application/xml') {
                conn.tak.write(new COT(req.body));
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

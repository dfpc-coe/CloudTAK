import { Type, Static } from '@sinclair/typebox'
import sleep from '../lib/sleep.js';
import { GenericListOrder } from '@openaddresses/batch-generic';
import Schema from '@openaddresses/batch-schema';
import { check } from '@placemarkio/check-geojson';
import bodyparser from 'body-parser';
import Err from '@openaddresses/batch-error';
import { CoT } from '@tak-ps/node-tak';
import { Item as QueueItem } from '../lib/queue.js'
import Cacher from '../lib/cacher.js';
import Auth, { AuthResourceAccess } from '../lib/auth.js';
import Lambda from '../lib/aws/lambda.js';
import CloudFormation from '../lib/aws/cloudformation.js';
import Style, { StyleContainer } from '../lib/style.js';
import Alarm from '../lib/aws/alarm.js';
import DDBQueue from '../lib/queue.js';
import Config from '../lib/config.js';
import Schedule from '../lib/schedule.js';
import S3 from '../lib/aws/s3.js';
import { Feature } from 'geojson';
import { Param } from '@openaddresses/batch-generic';
import { sql } from 'drizzle-orm';
import { StandardResponse, LayerResponse } from '../lib/types.js';
import { Layer_Priority } from '../lib/enums.js';
import { Layer } from '../lib/schema.js';
import TAKAPI, { APIAuthCertificate, } from '../lib/tak-api.js';

export default async function router(schema: Schema, config: Config) {
    const alarm = new Alarm(config.StackName);
    const ddb = new DDBQueue(config.StackName);
    ddb.on('error', (err) => { console.error(err); });

    await schema.get('/layer', {
        name: 'List Layers',
        group: 'Layer',
        description: 'List layers',
        query: Type.Object({
            limit: Type.Optional(Type.Integer()),
            page: Type.Optional(Type.Integer()),
            order: Type.Optional(Type.Enum(GenericListOrder)),
            sort: Type.Optional(Type.String({default: 'created', enum: Object.keys(Layer)})),
            filter: Type.Optional(Type.String({default: ''})),
            data: Type.Optional(Type.Integer()),
            connection: Type.Optional(Type.Integer()),
        }),
        res: Type.Object({
            total: Type.Integer(),
            status: Type.Object({
                healthy: Type.Integer(),
                alarm: Type.Integer(),
                unknown: Type.Integer(),
            }),
            items: Type.Array(LayerResponse)
        })
    }, async (req, res) => {
        try {
            await Auth.is_auth(config, req);

            const list = await config.models.Layer.list({
                limit: req.query.limit,
                page: req.query.page,
                order: req.query.order,
                sort: req.query.sort,
                where: sql`
                    name ~* ${req.query.filter}
                    AND (${Param(req.query.connection)}::BIGINT IS NULL OR ${Param(req.query.connection)}::BIGINT = layers.connection)
                    AND (${Param(req.query.data)}::BIGINT IS NULL OR ${Param(req.query.data)}::BIGINT = layers.data)
                `
            });

            const alarms = config.StackName !== 'test' ? await alarm.list() : new Map();

            const status = { healthy: 0, alarm: 0, unknown: 0 };
            for (const state of alarms.values()) {
                if (state === 'healthy') status.healthy++;
                if (state === 'alarm') status.alarm++;
                if (state === 'unknown') status.unknown++;
            }

            res.json({
                status,
                total: list.total,
                items: list.items.map((layer) => {
                    return { status: alarms.get(layer.id) || 'unknown', ...layer }
                })
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.post('/layer', {
        name: 'Create Layer',
        group: 'Layer',
        description: 'Register a new layer',
        body: Type.Object({
            name: Type.String(),
            priority: Type.Optional(Type.Enum(Layer_Priority)),
            description: Type.String(),
            enabled: Type.Boolean(),
            task: Type.String(),
            cron: Type.String(),
            logging: Type.Boolean(),
            stale: Type.Optional(Type.Integer()),
            connection: Type.Optional(Type.Integer()),
            data: Type.Optional(Type.Integer()),
            schema: Type.Optional(Type.Any()),
            styles: Type.Optional(StyleContainer)
        }),
        res: LayerResponse
    }, async (req, res) => {
        try {
            await Auth.is_auth(config, req);

            if (req.body.styles) {
                await Style.validate(req.body.styles);

                const style = req.body.styles as Static<typeof StyleContainer>;

                if (style.queries) {
                    req.body.styles = {
                        queries: style.queries
                    };
                } else {
                    req.body.styles = {
                        point: style.point,
                        line: style.line,
                        polygon: style.polygon
                    };
                }
            }

            if ((!req.body.connection && !req.body.data) || (req.body.connection && req.body.data)) {
                throw new Err(400, null, 'Either connection or data must be set');
            } else if (req.body.connection) {
                req.body.data = null;
            } else if (req.body.data) {
                req.body.connection = null;

                const data = await config.models.Data.from(req.body.data);
                if (data.mission_diff && await config.models.Layer.count({
                    where: sql`data = ${req.body.data}`
                }) > 1) {
                    throw new Err(400, null, 'Only a single layer can be added to a DataSync with Mission Diff Enabled')
                }
            }

            Schedule.is_valid(req.body.cron);
            let layer = await config.models.Layer.generate(req.body);

            if (config.events) {
                if (layer.cron && !Schedule.is_aws(layer.cron) && layer.enabled) {
                    config.events.add(layer.id, layer.cron);
                } else if (layer.cron && Schedule.is_aws(layer.cron) || !layer.enabled) {
                    await config.events.delete(layer.id);
                }
            }

            try {
                const stack = await Lambda.generate(config, layer);
                await CloudFormation.create(config, layer.id, stack);
            } catch (err) {
                console.error(err);
            }

            return res.json({
                status: config.StackName !== 'test' ? await alarm.get(layer.id) : 'unknown',
                ...layer
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.post('/layer/redeploy', {
        name: 'Redeploy Layers',
        group: 'Layer',
        description: 'Redeploy all Layers with latest CloudFormation output',
        res: StandardResponse
    }, async (req, res) => {
        try {
            await Auth.is_auth(config, req);

            let page = 0;
            let list;
            do {
                list = await config.models.Layer.list({ page, limit: 25 });
                ++page;

                for (const layer of list.items) {
                    try {
                        const stack = await Lambda.generate(config, layer);
                        if (await CloudFormation.exists(config, layer.id)) {
                            await CloudFormation.update(config, layer.id, stack);
                        } else {
                            await CloudFormation.create(config, layer.id, stack);
                        }

                        await sleep(50) //Otherwise AWS will throw Throttling exceptions
                    } catch (err) {
                        console.error(err);
                    }
                }
            } while (list.items.length)

            return res.json({
                status: 200,
                message: 'Layers Redeploying'
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.patch('/layer/:layerid', {
        name: 'Update Layer',
        group: 'Layer',
        description: 'Update a layer',
        params: Type.Object({
            layerid: Type.Integer(),
        }),
        body: Type.Object({
            name: Type.Optional(Type.String()),
            priority: Type.Optional(Type.Enum(Layer_Priority)),
            description: Type.Optional(Type.String()),
            cron: Type.Optional(Type.String()),
            memory: Type.Optional(Type.Integer()),
            timeout: Type.Optional(Type.Integer()),
            enabled: Type.Optional(Type.Boolean()),
            enabled_styles: Type.Optional(Type.Boolean()),
            task: Type.Optional(Type.String()),
            styles: Type.Optional(StyleContainer),
            logging: Type.Optional(Type.Boolean()),
            stale: Type.Optional(Type.Integer()),
            connection: Type.Optional(Type.Integer()),
            data: Type.Optional(Type.Integer()),
            environment: Type.Optional(Type.Any()),
            schema: Type.Optional(Type.Any())
        }),
        res: LayerResponse
    }, async (req, res) => {
        try {
            await Auth.is_auth(config, req, {
                resources: [{ access: AuthResourceAccess.LAYER, id: req.params.layerid }]
            });

            if (req.body.styles) {
                await Style.validate(req.body.styles);

                const style = req.body.styles as Static<typeof StyleContainer>;

                if (style.queries) {
                    req.body.styles = {
                        queries: style.queries
                    };
                } else {
                    req.body.styles = {
                        point: style.point,
                        line: style.line,
                        polygon: style.polygon
                    };
                }
            }

            if (req.body.connection && req.body.data) {
                throw new Err(400, null, 'Either connection or data must be set');
            } else if (req.body.connection) {
                req.body.data = null;
            } else if (req.body.data) {
                req.body.connection = null;
            }

            if (req.body.cron) Schedule.is_valid(req.body.cron);

            let layer = await config.models.Layer.from(req.params.layerid);

            let changed = false;
            // Avoid Updating CF unless necessary as it blocks further updates until deployed
            for (const prop of ['cron', 'task', 'memory', 'timeout', 'enabled', 'priority']) {
                if (req.body[prop] !== undefined && req.body[prop] !== layer[prop]) changed = true;
            }

            if (changed) {
                const status = (await CloudFormation.status(config, req.params.layerid)).status;
                if (!status.endsWith('_COMPLETE')) throw new Err(400, null, 'Layer is still Deploying, Wait for Deploy to succeed before updating')
            }

            layer = await config.models.Layer.commit(layer.id, { updated: sql`Now()`, ...req.body });

            if (changed) {
                try {
                    const stack = await Lambda.generate(config, layer);
                    if (await CloudFormation.exists(config, layer.id)) {
                        await CloudFormation.update(config, layer.id, stack);
                    } else {
                        await CloudFormation.create(config, layer.id, stack);
                    }
                } catch (err) {
                    console.error(err);
                }
            }

            if (config.events) {
                if (layer.cron && !Schedule.is_aws(layer.cron) && layer.enabled) {
                    config.events.add(layer.id, layer.cron);
                } else if (layer.cron && Schedule.is_aws(layer.cron) || !layer.enabled) {
                    await config.events.delete(layer.id);
                }
            }

            await config.cacher.del(`layer-${req.params.layerid}`);

            return res.json({
                status: config.StackName !== 'test' ? await alarm.get(layer.id) : 'unknown',
                ...layer
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.get('/layer/:layerid', {
        name: 'Get Layer',
        group: 'Layer',
        description: 'Get a layer',
        params: Type.Object({
            layerid: Type.Integer(),
        }),
        res: LayerResponse
    }, async (req, res) => {
        try {
            await Auth.is_auth(config, req, {
                resources: [{ access: AuthResourceAccess.LAYER, id: req.params.layerid }]
            });

            const layer = await config.cacher.get(Cacher.Miss(req.query, `layer-${req.params.layerid}`), async () => {
                return await config.models.Layer.from(req.params.layerid);
            });

            return res.json({
                status: config.StackName !== 'test' ? await alarm.get(layer.id) : 'unknown',
                ...layer
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.post('/layer/:layerid/redeploy', {
        name: 'Redeploy Layers',
        group: 'Layer',
        description: 'Redeploy a specific Layer with latest CloudFormation output',
        params: Type.Object({
            layerid: Type.Integer()
        }),
        res: StandardResponse
    }, async (req, res) => {
        try {
            await Auth.is_auth(config, req);

            const layer = await config.models.Layer.from(req.params.layerid);

            const status = (await CloudFormation.status(config, req.params.layerid)).status;
            if (!status.endsWith('_COMPLETE')) throw new Err(400, null, 'Layer is still Deploying, Wait for Deploy to succeed before updating')

            try {
                const stack = await Lambda.generate(config, layer);
                if (await CloudFormation.exists(config, layer.id)) {
                    await CloudFormation.update(config, layer.id, stack);
                } else {
                    await CloudFormation.create(config, layer.id, stack);
                }
            } catch (err) {
                console.error(err);
            }

            return res.json({
                status: 200,
                message: 'Layer Redeploying'
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.delete('/layer/:layerid', {
        name: 'Delete Layer',
        group: 'Layer',
        description: 'Delete a layer',
        params: Type.Object({
            layerid: Type.Integer()
        }),
        res: StandardResponse
    }, async (req, res) => {
        try {
            await Auth.is_auth(config, req);

            const layer = await config.models.Layer.from(req.params.layerid);

            await CloudFormation.delete(config, layer.id);

            if (config.events) config.events.delete(layer.id);

            await config.models.Layer.delete(req.params.layerid);

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
        description: 'Post CoT data to a given layer',
        params: Type.Object({
            layerid: Type.Integer()
        }),
        query: Type.Object({
            logging: Type.Optional(Type.Boolean({ "description": "If logging is enabled for the layer, allow callers to skip logging for a particular CoT payload" }))
        }),
        body: Type.Any(),
        res: StandardResponse
    }, async (req, res) => {
        try {
            await Auth.is_auth(config, req, {
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
            if (!layer.data && layer.connection) {
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

                } else {
                    for (const feat of req.body.features) {
                        feat.properties.dest = [{ mission: data.name }];
                        cots.push(CoT.from_geojson(feat))
                    }
                }
            } else {
                throw new Err(400, null, 'Either connection or data must be set');
            }

            if (!pooledClient || !pooledClient.config || !pooledClient.config.enabled) {
                return res.json({ status: 200, message: 'Recieved but Connection Paused' });
            }

            if (cots.length === 0) return res.json({ status: 200, message: 'No features found' });

            pooledClient.tak.write(cots);
            for (const cot of cots) config.conns.cot(pooledClient.config, cot);

            if (data) {
                const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(pooledClient.config.auth.cert, pooledClient.config.auth.key));
                const missionContent = await api.Mission.attachContents(data.name, {
                    uids: cots.map((cot) => { return cot.raw.event._attributes.uid })
                }, {
                    token: data.mission_token
                });
            }

            // TODO Only GeoJSON Features go to Dynamo, this should also store CoT XML
            // @ts-ignore
            if (layer.logging && req.query.logging !== false) ddb.queue(req.body.features.map((feat: Feature) => {
                const item: QueueItem = {
                    id: String(feat.id),
                    layer: layer.id,
                    type: feat.type,
                    // @ts-ignore
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

import { Type } from '@sinclair/typebox'
import sleep from '../lib/sleep.js';
import { GenericListOrder } from '@openaddresses/batch-generic';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Cacher from '../lib/cacher.js';
import Auth, { AuthResourceAccess } from '../lib/auth.js';
import Lambda from '../lib/aws/lambda.js';
import CloudFormation from '../lib/aws/cloudformation.js';
import Style, { StyleContainer } from '../lib/style.js';
import Alarm from '../lib/aws/alarm.js';
import Config from '../lib/config.js';
import Schedule from '../lib/schedule.js';
import { Param } from '@openaddresses/batch-generic';
import { sql } from 'drizzle-orm';
import { StandardResponse, LayerResponse } from '../lib/types.js';
import { Layer_Config } from '../lib/models/Layer.js';
import { Layer_Priority } from '../lib/enums.js';
import { Layer } from '../lib/schema.js';

export default async function router(schema: Schema, config: Config) {
    const alarm = new Alarm(config.StackName);

    await schema.post('/layer/redeploy', {
        name: 'Redeploy Layers',
        group: 'LayerAdmin',
        params: Type.Object({
            connectionid: Type.Integer()
        }),
        description: 'Redeploy all Layers with latest CloudFormation output',
        res: StandardResponse
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req, { admin: true });

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


    await schema.get('/connection/:connectionid/layer', {
        name: 'List Layers',
        group: 'Layer',
        description: 'List layers',
        params: Type.Object({
            connectionid: Type.Integer()
        }),
        query: Type.Object({
            limit: Type.Integer({ default: 10 }),
            page: Type.Integer({ default: 0 }),
            order: Type.Enum(GenericListOrder, { default: GenericListOrder.ASC }),
            sort: Type.Optional(Type.String({default: 'created', enum: Object.keys(Layer)})),
            filter: Type.Optional(Type.String({default: ''})),
            data: Type.Optional(Type.Integer()),
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
            await Auth.is_connection(config, req, {
                resources: [{ access: AuthResourceAccess.CONNECTION, id: req.params.connectionid }]
            }, req.params.connectionid);

            const list = await config.models.Layer.list({
                limit: req.query.limit,
                page: req.query.page,
                order: req.query.order,
                sort: req.query.sort,
                where: sql`
                    name ~* ${req.query.filter}
                    AND connection = ${req.params.connectionid}
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

    await schema.post('/connection/:connectionid/layer', {
        name: 'Create Layer',
        group: 'Layer',
        description: 'Register a new layer',
        params: Type.Object({
            connectionid: Type.Integer()
        }),
        body: Type.Object({
            name: Type.String(),
            priority: Type.Optional(Type.Enum(Layer_Priority)),
            description: Type.String(),
            enabled: Type.Boolean(),
            task: Type.String(),
            cron: Type.String(),
            logging: Type.Boolean(),
            stale: Type.Optional(Type.Integer()),
            data: Type.Optional(Type.Integer()),
            schema: Type.Optional(Type.Any()),
            styles: Type.Optional(StyleContainer)
        }),
        res: LayerResponse
    }, async (req, res) => {
        try {
            await Auth.is_connection(config, req, {
                resources: [{ access: AuthResourceAccess.CONNECTION, id: req.params.connectionid }]
            }, req.params.connectionid);

            if (req.body.styles) {
                await Style.validate(req.body.styles);
            }

            if (req.body.data) {
                const data = await config.models.Data.from(req.body.data);
                if (data.mission_diff && await config.models.Layer.count({
                    where: sql`data = ${req.body.data}`
                }) > 1) {
                    throw new Err(400, null, 'Only a single layer can be added to a DataSync with Mission Diff Enabled')
                }

                if (data.connection !== req.params.connectionid) {
                    throw new Err(400, null, 'Layer cannot reference a Data Sync that is not part of the current connection');
                }
            }

            Schedule.is_valid(req.body.cron);
            const layer = await config.models.Layer.generate({
                connection: req.params.connectionid,
                ...req.body
            });

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

    await schema.patch('/connection/:connectionid/layer/:layerid', {
        name: 'Update Layer',
        group: 'Layer',
        description: 'Update a layer',
        params: Type.Object({
            layerid: Type.Integer(),
            connectionid: Type.Integer()
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
            data: Type.Optional(Type.Integer()),
            environment: Type.Optional(Type.Any()),
            config: Type.Optional(Layer_Config),
            schema: Type.Optional(Type.Any())
        }),
        res: LayerResponse
    }, async (req, res) => {
        try {
            const { connection } = await Auth.is_connection(config, req, {
                resources: [
                    { access: AuthResourceAccess.CONNECTION, id: req.params.connectionid },
                    { access: AuthResourceAccess.LAYER, id: req.params.layerid }
                ]
            }, req.params.connectionid);

            if (req.body.styles) {
                await Style.validate(req.body.styles);
            }

            if (req.body.cron) Schedule.is_valid(req.body.cron);

            let layer = await config.models.Layer.from(req.params.layerid);

            if (layer.connection !== connection.id) {
                throw new Err(400, null, 'Layer does not belong to this connection');
            }

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

    await schema.get('/connection/:connectionid/layer/:layerid', {
        name: 'Get Layer',
        group: 'Layer',
        description: 'Get a layer',
        params: Type.Object({
            connectionid: Type.Integer(),
            layerid: Type.Integer(),
        }),
        res: LayerResponse
    }, async (req, res) => {
        try {
            const { connection } = await Auth.is_connection(config, req, {
                resources: [
                    { access: AuthResourceAccess.CONNECTION, id: req.params.connectionid },
                    { access: AuthResourceAccess.LAYER, id: req.params.layerid }
                ]
            }, req.params.connectionid);

            const layer = await config.cacher.get(Cacher.Miss(req.query, `layer-${req.params.layerid}`), async () => {
                return await config.models.Layer.from(req.params.layerid);
            });

            if (layer.connection !== connection.id) {
                throw new Err(400, null, 'Layer does not belong to this connection');
            }

            return res.json({
                status: config.StackName !== 'test' ? await alarm.get(layer.id) : 'unknown',
                ...layer
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.post('/connection/:connectionid/layer/:layerid/redeploy', {
        name: 'Redeploy Layers',
        group: 'Layer',
        description: 'Redeploy a specific Layer with latest CloudFormation output',
        params: Type.Object({
            connectionid: Type.Integer(),
            layerid: Type.Integer()
        }),
        res: StandardResponse
    }, async (req, res) => {
        try {
            const { connection } = await Auth.is_connection(config, req, {
                resources: [
                    { access: AuthResourceAccess.CONNECTION, id: req.params.connectionid }
                ]
            }, req.params.connectionid);

            const layer = await config.models.Layer.from(req.params.layerid);

            if (layer.connection !== connection.id) {
                throw new Err(400, null, 'Layer does not belong to this connection');
            }

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

    await schema.delete('/connection/:connectionid/layer/:layerid', {
        name: 'Delete Layer',
        group: 'Layer',
        description: 'Delete a layer',
        params: Type.Object({
            connectionid: Type.Integer(),
            layerid: Type.Integer()
        }),
        res: StandardResponse
    }, async (req, res) => {
        try {
            const { connection } = await Auth.is_connection(config, req, {
                resources: [
                    { access: AuthResourceAccess.CONNECTION, id: req.params.connectionid }
                ]
            }, req.params.connectionid);

            const layer = await config.models.Layer.from(req.params.layerid);

            if (layer.connection !== connection.id) {
                throw new Err(400, null, 'Layer does not belong to this connection');
            }

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
}

import { Type } from '@sinclair/typebox'
import sleep from '../lib/sleep.js';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import { TAKAPI, APIAuthCertificate, } from '@tak-ps/node-tak';
import Auth, { AuthResourceAccess, AuthUser } from '../lib/auth.js';
import Lambda from '../lib/aws/lambda.js';
import CloudFormation from '../lib/aws/cloudformation.js';
import Style, { StyleContainer } from '../lib/style.js';
import Filter, { FilterContainer } from '../lib/filter.js';
import Alarm from '../lib/aws/alarm.js';
import Config from '../lib/config.js';
import Schedule from '../lib/schedule.js';
import LayerControl from '../lib/control/layer.js';
import { Param } from '@openaddresses/batch-generic';
import { sql, eq } from 'drizzle-orm';
import type { InferInsertModel } from 'drizzle-orm';;
import { StandardResponse, LayerResponse, LayerIncomingResponse, LayerOutgoingResponse } from '../lib/types.js';
import { LayerIncoming, LayerOutgoing } from '../lib/schema.js';
import DataMission from '../lib/data-mission.js';
import { MAX_LAYERS_IN_DATA_SYNC } from '../lib/data-mission.js';
import { Layer_Config } from '../lib/models/Layer.js';
import { Layer_Priority } from '../lib/enums.js';
import { Layer } from '../lib/schema.js';
import * as Default from '../lib/limits.js';

export default async function router(schema: Schema, config: Config) {
    const alarm = new Alarm(config.StackName);
    const layerControl = new LayerControl(config);

    await schema.post('/layer/redeploy', {
        name: 'Redeploy Layers',
        group: 'LayerAdmin',
        description: 'Redeploy all Layers with latest CloudFormation output',
        res: StandardResponse
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req, { admin: true });

            let page = 0;
            let list;
            do {
                list = await config.models.Layer.augmented_list({ page, limit: 25 });
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

            res.json({
                status: 200,
                message: 'Layers Redeploying'
            });
        } catch (err) {
            Err.respond(err, res);
        }
    });


    await schema.get('/connection/:connectionid/layer', {
        name: 'List Layers',
        group: 'Layer',
        description: 'List layers',
        params: Type.Object({
            connectionid: Type.Union([
                Type.Literal('template'),
                Type.Integer({ minimum: 1 })
            ])
        }),
        query: Type.Object({
            alarms: Type.Boolean({
                default: false,
                description: 'Get Live Alarm state from CloudWatch'
            }),
            limit: Default.Limit,
            page: Default.Page,
            order: Default.Order,
            sort: Type.String({
                default: 'created',
                enum: Object.keys(Layer)
            }),
            filter: Default.Filter,
            data: Type.Optional(Type.Integer({ minimum: 1 })),
        }),
        res: Type.Object({
            total: Type.Integer(),
            tasks: Type.Array(Type.String()),
            status: Type.Object({
                healthy: Type.Integer(),
                alarm: Type.Integer(),
                unknown: Type.Integer(),
            }),
            items: Type.Array(LayerResponse)
        })
    }, async (req, res) => {
        try {
            const resources = [{ access: AuthResourceAccess.CONNECTION, id: req.params.connectionid }]

            if (req.params.connectionid === 'template') {
                await Auth.is_auth(config, req, { resources });
            } else {
                const { connection } = await Auth.is_connection(config, req, { resources }, req.params.connectionid);
                if (connection.readonly) throw new Err(400, null, 'Connection is Read-Only mode');
            }

            const list = await config.models.Layer.augmented_list({
                limit: req.query.limit,
                page: req.query.page,
                order: req.query.order,
                sort: req.query.sort,
                where: sql`
                    layers.name ~* ${req.query.filter}
                    AND connection = ${Param(req.params.connectionid === 'template' ? null : req.params.connectionid)}
                    AND (${Param(req.query.data)}::BIGINT IS NULL OR ${Param(req.query.data)}::BIGINT = layers_incoming.data)
                `
            });

            let alarms = new Map();
            const status = { healthy: 0, alarm: 0, unknown: 0 };
            try {
                alarms = (config.StackName !== 'test' && req.query.alarms) ? await alarm.list() : new Map();

                for (const state of alarms.values()) {
                    if (state === 'healthy') status.healthy++;
                    if (state === 'alarm') status.alarm++;
                    if (state === 'unknown') status.unknown++;
                }
            } catch (err) {
                // Surface this in the future - failing alarm lists shouldn't nuke access
                console.error(err);
            }

            res.json({
                status,
                tasks: await config.models.Layer.tasks(),
                total: list.total,
                items: list.items.map((layer) => {
                    return {
                        status: (config.StackName !== 'test' && req.query.alarms) ? (alarms.get(layer.id) || 'unknown') : 'unknown',
                        ...layer
                    }
                })
            });
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.post('/connection/:connectionid/layer', {
        name: 'Create Layer',
        group: 'Layer',
        description: 'Register a new layer',
        query: Type.Object({
            alarms: Type.Boolean({
                default: false,
                description: 'Get Live Alarm state from CloudWatch'
            }),
        }),
        params: Type.Object({
            connectionid: Type.Integer({ minimum: 1 })
        }),
        body: Type.Object({
            name: Default.NameField,
            task: Type.String(),
            priority: Type.Optional(Type.Enum(Layer_Priority)),
            description: Default.DescriptionField,
            enabled: Type.Optional(Type.Boolean()),
            logging: Type.Boolean({
                default: true,
                description: 'Enable Logging for this Layer'
            }),
            memory: Type.Integer({
                default: 256,
                description: 'Memory in MB for this Layer',
                minimum: 128,
                maximum: 10240
            }),
            timeout: Type.Integer({
                default: 120,
                description: 'Timeout in seconds for this Layer',
                minimum: 1,
                maximum: 900
            }),

            alarm_period: Type.Optional(Type.Integer()),
            alarm_evals: Type.Optional(Type.Integer()),
            alarm_points: Type.Optional(Type.Integer()),
        }),
        res: LayerResponse
    }, async (req, res) => {
        try {
            const { connection, auth } = await Auth.is_connection(config, req, {
                resources: [{ access: AuthResourceAccess.CONNECTION, id: req.params.connectionid }]
            }, req.params.connectionid);

            if (connection.readonly) throw new Err(400, null, 'Connection is Read-Only mode');

            const layer = await layerControl.generate({
                ...req.body,
                connection: req.params.connectionid,
                username: auth instanceof AuthUser ? auth.email : null
            }, {
                alarms: req.query.alarms
            });

            res.json(layer);
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.post('/connection/:connectionid/layer/:layerid/incoming', {
        name: 'Create Incoming',
        group: 'Layer',
        description: 'Register a new incoming layer config',
        params: Type.Object({
            connectionid: Type.Integer({ minimum: 1 }),
            layerid: Type.Integer({ minimum: 1 })
        }),
        body: Type.Object({
            webhooks: Type.Optional(Type.Boolean()),
            cron: Type.Optional(Type.String()),
            stale: Type.Optional(Type.Integer()),
            data: Type.Optional(Type.Integer()),
            groups: Type.Optional(Type.Array(Type.String())),
            enabled_styles: Type.Optional(Type.Boolean()),
            styles: Type.Optional(StyleContainer),
            config: Type.Optional(Layer_Config),
        }),
        res: LayerIncomingResponse
    }, async (req, res) => {
        try {
            const { connection } = await Auth.is_connection(config, req, {
                resources: [
                    { access: AuthResourceAccess.CONNECTION, id: req.params.connectionid },
                    { access: AuthResourceAccess.LAYER, id: req.params.layerid }
                ]
            }, req.params.connectionid);

            let layer = await layerControl.from(connection, req.params.layerid);

            if (req.body.data && req.body.groups && req.body.groups.length) {
                throw new Err(400, null, 'Layer cannot have both Data and Groups set');
            } else if (req.body.groups) {
                const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(connection.auth.cert, connection.auth.key));
                const list = await api.Group.list({ useCache: true });

                for (const group of req.body.groups) {
                    if (!list.data.find((g) => {
                        return g.name === group && g.direction === 'IN';
                    })) {
                        throw new Err(400, null, `Group "${group}" does not exist on TAK Server`);
                    }
                }
            }

            if (req.body.styles) {
                await Style.validate(req.body.styles);
            }

            if (req.body.cron) {
                Schedule.is_valid(req.body.cron);
            }

            if (req.body.data) {
                const data = await config.models.Data.from(req.body.data);
                if (data.mission_diff && parseInt(String(await config.models.LayerIncoming.count({
                    where: eq(LayerIncoming.data, req.body.data)
                }))) + 1 > MAX_LAYERS_IN_DATA_SYNC) {
                    throw new Err(400, null, `Only ${MAX_LAYERS_IN_DATA_SYNC} layers can be added to a DataSync with Mission Diff Enabled`)
                }

                if (data.connection !== req.params.connectionid) {
                    throw new Err(400, null, 'Layer cannot reference a Data Sync that is not part of the current connection');
                }
            }

            const incoming = await config.models.LayerIncoming.generate({
                layer: layer.id,
                ...req.body
            });

            layer = await layerControl.from(connection, req.params.layerid);

            if (config.events) {
                if (incoming.cron && !Schedule.is_aws(incoming.cron) && layer.enabled) {
                    config.events.add(layer.id, incoming.cron);
                } else if (!incoming.cron || (incoming.cron && Schedule.is_aws(incoming.cron)) || !layer.enabled) {
                    await config.events.delete(layer.id);
                }
            }

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

            if (req.body.data) {
                const data = await config.models.Data.from(req.body.data);

                try {
                    // Handle Potential Renames
                    await DataMission.sync(config, data);
                } catch (err) {
                    // Eventually do something
                    console.error(err);
                }
            }

            res.json(incoming);
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.patch('/connection/:connectionid/layer/:layerid/incoming', {
        name: 'Update Incoming',
        group: 'Layer',
        description: 'Update an incoming layer configuration',
        params: Type.Object({
            connectionid: Type.Integer({ minimum: 1 }),
            layerid: Type.Integer({ minimum: 1 }),
        }),
        body: Type.Object({
            webhooks: Type.Optional(Type.Boolean()),
            cron: Type.Optional(Type.Union([Type.Null(), Type.String()])),
            enabled_styles: Type.Optional(Type.Boolean()),
            styles: Type.Optional(StyleContainer),
            stale: Type.Optional(Type.Integer()),
            data: Type.Optional(Type.Union([Type.Null(), Type.Integer()])),
            groups: Type.Optional(Type.Array(Type.String())),
            environment: Type.Optional(Type.Any()),
            config: Type.Optional(Layer_Config),
        }),
        res: LayerIncomingResponse
    }, async (req, res) => {
        try {
            const { connection } = await Auth.is_connection(config, req, {
                resources: [
                    { access: AuthResourceAccess.CONNECTION, id: req.params.connectionid },
                    { access: AuthResourceAccess.LAYER, id: req.params.layerid }
                ]
            }, req.params.connectionid);

            const layer = await layerControl.from(connection, req.params.layerid);

            if (layer.connection !== connection.id) {
                throw new Err(400, null, 'Layer does not belong to this connection');
            } else if (!layer.incoming) {
                throw new Err(400, null, 'Layer does not have incoming config');
            }

            if (req.body.data && req.body.groups && req.body.groups.length) {
                throw new Err(400, null, 'Layer cannot have both Data and Groups set');
            } else if (req.body.groups) {
                const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(connection.auth.cert, connection.auth.key));
                const list = await api.Group.list({ useCache: true });

                for (const group of req.body.groups) {
                    if (!list.data.find((g) => {
                        return g.name === group && g.direction === 'IN';
                    })) {
                        throw new Err(400, null, `Group "${group}" does not exist on TAK Server`);
                    }
                }
            }

            if (req.body.data) {
                const data = await config.models.Data.from(req.body.data);

                const modifier = layer.incoming.data === req.body.data ? 0 : 1;

                if (data.mission_diff && parseInt(String(await config.models.LayerIncoming.count({
                    where: eq(LayerIncoming.data, req.body.data)
                }))) + modifier > MAX_LAYERS_IN_DATA_SYNC) {
                    throw new Err(400, null, `Only ${MAX_LAYERS_IN_DATA_SYNC} layers can be added to a DataSync with Mission Diff Enabled`)
                }

                if (data.connection !== req.params.connectionid) {
                    throw new Err(400, null, 'Layer cannot reference a Data Sync that is not part of the current connection');
                }

                try {
                    // Handle Potential Renames
                    await DataMission.sync(config, data);
                } catch (err) {
                    // Eventually do something
                    console.error(err);
                }
            }

            if (req.body.styles) {
                await Style.validate(req.body.styles);
            }

            if (req.body.cron) {
                Schedule.is_valid(req.body.cron);
            }

            let changed = false;
            // Avoid Updating CF unless necessary as it blocks further updates until deployed
            for (const prop of [ 'cron', 'webhooks' ]) {
                // @ts-expect-error Doesn't like indexed values
                if (req.body[prop] !== undefined && req.body[prop] !== layer[prop]) changed = true;
            }

            if (changed) {
                const status = (await CloudFormation.status(config, req.params.layerid)).status;
                if (!status.endsWith('_COMPLETE')) throw new Err(400, null, 'Layer is still Deploying, Wait for Deploy to succeed before updating')
            }

            const updated: InferInsertModel<typeof LayerIncoming> = {
                // @ts-expect-error Inference expects a Date and not an SQL blob
                updated: sql`Now()`,
                ...req.body
            }

            // Ephemeral storage stores cached password, if the env changes, the ephemeral storage should be cleared
            if (req.body.environment) {
                updated.ephemeral = {};
            }

            const incoming = await config.models.LayerIncoming.commit(layer.id, updated)

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
                if (incoming.cron && !Schedule.is_aws(incoming.cron) && layer.enabled) {
                    config.events.add(layer.id, incoming.cron);
                } else if (!incoming.cron || (incoming.cron && Schedule.is_aws(incoming.cron)) || !layer.enabled) {
                    await config.events.delete(layer.id);
                }
            }

            if (req.body.data) {
                const data = await config.models.Data.from(req.body.data);

                try {
                    // Handle Potential Renames
                    await DataMission.sync(config, data);
                } catch (err) {
                    // Eventually do something
                    console.error(err);
                }
            }

            if (req.body.environment) {
                await Lambda.invoke(config, layer.id, 'environment:incoming')
            }

            res.json(incoming);
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.delete('/connection/:connectionid/layer/:layerid/incoming', {
        name: 'Delete Incoming',
        group: 'Layer',
        description: 'Remove an incoming config from a layer',
        params: Type.Object({
            connectionid: Type.Integer({ minimum: 1 }),
            layerid: Type.Integer({ minimum: 1 })
        }),
        res: StandardResponse
    }, async (req, res) => {
        try {
            const { connection } = await Auth.is_connection(config, req, {
                resources: [
                    { access: AuthResourceAccess.CONNECTION, id: req.params.connectionid },
                    { access: AuthResourceAccess.LAYER, id: req.params.layerid }
                ]
            }, req.params.connectionid);

            let layer = await layerControl.from(connection, req.params.layerid);

            if (!layer.incoming) {
                throw new Err(400, null, 'Layer does not have an incoming configuration');
            }

            const status = (await CloudFormation.status(config, req.params.layerid)).status;
            if (!status.endsWith('_COMPLETE')) throw new Err(400, null, 'Layer is still Deploying, Wait for Deploy to succeed before deleting')

            await config.models.LayerIncoming.delete(layer.id);

            layer = await layerControl.from(connection, req.params.layerid);

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

            res.json({
                status: 200,
                message: 'Incoming Layer Config Deleted'
            });
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.post('/connection/:connectionid/layer/:layerid/outgoing', {
        name: 'Create Outgoing',
        group: 'Layer',
        description: 'Register a new incoming layer config',
        params: Type.Object({
            connectionid: Type.Integer({ minimum: 1 }),
            layerid: Type.Integer({ minimum: 1 })
        }),
        body: Type.Object({
            filters: Type.Optional(FilterContainer)
        }),
        res: LayerOutgoingResponse
    }, async (req, res) => {
        try {
            const { connection } = await Auth.is_connection(config, req, {
                resources: [
                    { access: AuthResourceAccess.CONNECTION, id: req.params.connectionid },
                    { access: AuthResourceAccess.LAYER, id: req.params.layerid }
                ]
            }, req.params.connectionid);

            let layer = await layerControl.from(connection, req.params.layerid);

            if (req.body.filters) {
                await Filter.validate(req.body.filters);
            }

            const incoming = await config.models.LayerOutgoing.generate({
                layer: layer.id,
                ...req.body
            });

            layer = await layerControl.from(connection, req.params.layerid);

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

            res.json(incoming);
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.patch('/connection/:connectionid/layer/:layerid/outgoing', {
        name: 'Update Outgoing',
        group: 'Layer',
        description: 'Update an outgoing layer configuration',
        params: Type.Object({
            connectionid: Type.Integer({ minimum: 1 }),
            layerid: Type.Integer({ minimum: 1 }),
        }),
        body: Type.Object({
            environment: Type.Optional(Type.Any()),
            filters: Type.Optional(FilterContainer),
        }),
        res: LayerOutgoingResponse
    }, async (req, res) => {
        try {
            const { connection } = await Auth.is_connection(config, req, {
                resources: [
                    { access: AuthResourceAccess.CONNECTION, id: req.params.connectionid },
                    { access: AuthResourceAccess.LAYER, id: req.params.layerid }
                ]
            }, req.params.connectionid);

            const layer = await layerControl.from(connection, req.params.layerid);

            if (!layer.outgoing) {
                throw new Err(400, null, 'Layer does not have outgoing config');
            }

            const updated: InferInsertModel<typeof LayerOutgoing> = {
                // @ts-expect-error Inference expects a Date and not an SQL blob
                updated: sql`Now()`,
                ...req.body
            }

            // Ephemeral storage stores cached password, if the env changes, the ephemeral storage should be cleared
            if (req.body.environment) {
                updated.ephemeral = {};
            }

            if (req.body.filters) {
                await Filter.validate(req.body.filters);
            }

            const outgoing = await config.models.LayerOutgoing.commit(layer.id, updated);

            if (req.body.environment) {
                await Lambda.invoke(config, layer.id, 'environment:outgoing')
            }

            res.json(outgoing);
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.delete('/connection/:connectionid/layer/:layerid/outgoing', {
        name: 'Delete Outgoing',
        group: 'Layer',
        description: 'Remove an outgoing config from a layer',
        params: Type.Object({
            connectionid: Type.Integer({ minimum: 1 }),
            layerid: Type.Integer({ minimum: 1 })
        }),
        res: StandardResponse
    }, async (req, res) => {
        try {
            const { connection } = await Auth.is_connection(config, req, {
                resources: [
                    { access: AuthResourceAccess.CONNECTION, id: req.params.connectionid },
                    { access: AuthResourceAccess.LAYER, id: req.params.layerid }
                ]
            }, req.params.connectionid);

            let layer = await layerControl.from(connection, req.params.layerid);

            if (!layer.outgoing) {
                throw new Err(400, null, 'Layer does not have an outgoing configuration');
            }

            const status = (await CloudFormation.status(config, req.params.layerid)).status;
            if (!status.endsWith('_COMPLETE')) throw new Err(400, null, 'Layer is still Deploying, Wait for Deploy to succeed before deleting')

            await config.models.LayerOutgoing.delete(layer.id);

            layer = await layerControl.from(connection, req.params.layerid);

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

            res.json({
                status: 200,
                message: 'Outgoing Layer Config Deleted'
            });
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.patch('/connection/:connectionid/layer/:layerid', {
        name: 'Update Layer',
        group: 'Layer',
        description: 'Update a layer',
        query: Type.Object({
            alarms: Type.Boolean({
                default: false,
                description: 'Get Live Alarm state from CloudWatch'
            }),
        }),
        params: Type.Object({
            connectionid: Type.Integer({ minimum: 1 }),
            layerid: Type.Integer({ minimum: 1 }),
        }),
        body: Type.Object({
            name: Type.Optional(Default.NameField),
            priority: Type.Optional(Type.Enum(Layer_Priority)),
            description: Type.Optional(Default.DescriptionField),
            memory: Type.Optional(Type.Integer({
                description: 'Memory in MB for this Layer',
                minimum: 128,
                maximum: 10240
            })),
            timeout: Type.Optional(Type.Integer({
                description: 'Timeout in seconds for this Layer',
                minimum: 1,
                maximum: 900
            })),
            enabled: Type.Optional(Type.Boolean()),
            task: Type.Optional(Type.String()),
            logging: Type.Optional(Type.Boolean()),

            alarm_period: Type.Optional(Type.Integer()),
            alarm_evals: Type.Optional(Type.Integer()),
            alarm_points: Type.Optional(Type.Integer()),
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

            let layer = await layerControl.from(connection, req.params.layerid);

            let changed = false;
            // Avoid Updating CF unless necessary as it blocks further updates until deployed
            for (const prop of [ 'task', 'memory', 'timeout', 'enabled', 'priority', 'alarm_period', 'alarm_evals', 'alarm_points']) {
                // @ts-expect-error Doesn't like indexed values
                if (req.body[prop] !== undefined && req.body[prop] !== layer[prop]) changed = true;
            }

            if (changed) {
                const status = (await CloudFormation.status(config, req.params.layerid)).status;
                if (!status.endsWith('_COMPLETE')) {
                    throw new Err(400, null, 'Layer is still Deploying, Wait for Deploy to succeed before updating')
                }
            }

            await config.models.Layer.commit(layer.id, {
                updated: sql`Now()`,
                ...req.body
            });

            layer = await layerControl.from(connection, req.params.layerid);

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

            layer = await layerControl.from(connection, req.params.layerid);

            if (layer.incoming && config.events) {
                if (layer.incoming.cron && !Schedule.is_aws(layer.incoming.cron) && layer.enabled) {
                    config.events.add(layer.id, layer.incoming.cron);
                } else if (!layer.incoming.cron || (layer.incoming.cron && Schedule.is_aws(layer.incoming.cron)) || !layer.enabled) {
                    await config.events.delete(layer.id);
                }
            }

            let status = 'unknown';
            if (config.StackName !== 'test' && req.query.alarms) {
                try {
                    status = await alarm.get(layer.id);
                } catch (err) {
                    console.error(err);
                }
            }

            res.json({
                status,
                ...layer
            });
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.get('/connection/:connectionid/layer/:layerid', {
        name: 'Get Layer',
        group: 'Layer',
        description: 'Get a layer',
        query: Type.Object({
            alarms: Type.Boolean({
                default: false,
                description: 'Get Live Alarm state from CloudWatch'
            }),
            token: Type.Optional(Type.String()),
            download: Type.Boolean({
                default: false,
                description: 'Download Layer as JSON file'
            })
        }),
        params: Type.Object({
            connectionid: Type.Union([
                Type.Literal('template'),
                Type.Integer({ minimum: 1 })
            ]),
            layerid: Type.Integer({ minimum: 1 }),
        }),
        res: LayerResponse
    }, async (req, res) => {
        try {
            const resources = [
                { access: AuthResourceAccess.CONNECTION, id: req.params.connectionid },
                { access: AuthResourceAccess.LAYER, id: req.params.layerid }
            ];

            let layer;
            if (req.params.connectionid === 'template') {
                await Auth.is_auth(config, req, {
                    token: true, resources
                });

                layer = await layerControl.from(null, req.params.layerid);
            } else {
                const { connection } = await Auth.is_connection(config, req, {
                    token: true, resources
                }, req.params.connectionid);

                if (connection.readonly) throw new Err(400, null, 'Connection is Read-Only mode');

                layer = await layerControl.from(connection, req.params.layerid);
            }

            let status = 'unknown';
            if (config.StackName !== 'test' && req.query.alarms) {
                try {
                    status = await alarm.get(layer.id);
                } catch (err) {
                    console.error(err);
                }
            }

            const hydrated = { status, ...layer };

            if (req.query.download) {
                res.setHeader('Content-Disposition', `attachment; filename="connection-${req.params.connectionid}-layer-${layer.id}.json"`);
                res.setHeader('Content-Type', 'application/json');
                res.write(JSON.stringify(hydrated, null, 4));
                res.end();
            } else {
                res.json({
                    status,
                    ...layer
                });
            }
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.post('/connection/:connectionid/layer/:layerid/redeploy', {
        name: 'Redeploy Layers',
        group: 'Layer',
        description: 'Redeploy a specific Layer with latest CloudFormation output',
        params: Type.Object({
            connectionid: Type.Union([
                Type.Literal('template'),
                Type.Integer({ minimum: 1 })
            ]),
            layerid: Type.Integer({ minimum: 1 }),
        }),
        res: StandardResponse
    }, async (req, res) => {
        try {
            const resources = [
                { access: AuthResourceAccess.CONNECTION, id: req.params.connectionid }
            ];

            let layer;
            if (req.params.connectionid === 'template') {
                await Auth.is_auth(config, req, { resources });

                layer = await layerControl.from(null, req.params.layerid);
            } else {
                const { connection } = await Auth.is_connection(config, req, { resources }, req.params.connectionid);

                layer = await layerControl.from(connection, req.params.layerid);
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

            res.json({
                status: 200,
                message: 'Layer Redeploying'
            });
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.delete('/connection/:connectionid/layer/:layerid', {
        name: 'Delete Layer',
        group: 'Layer',
        description: 'Delete a layer',
        params: Type.Object({
            connectionid: Type.Union([
                Type.Literal('template'),
                Type.Integer({ minimum: 1 })
            ]),
            layerid: Type.Integer({ minimum: 1 }),
        }),
        res: StandardResponse
    }, async (req, res) => {
        try {
            const resources = [
                { access: AuthResourceAccess.CONNECTION, id: req.params.connectionid }
            ]

            let layer;
            if (req.params.connectionid === 'template') {
                await Auth.is_auth(config, req, { resources });
                layer = await layerControl.from(null, req.params.layerid);
            } else {
                const { connection } = await Auth.is_connection(config, req, { resources }, req.params.connectionid);
                layer = await layerControl.from(connection, req.params.layerid);
            }

            const status = (await CloudFormation.status(config, req.params.layerid)).status;
            if (!status.endsWith('_COMPLETE')) throw new Err(400, null, 'Layer is still Deploying, Wait for Deploy to succeed before deleting')

            await CloudFormation.delete(config, layer.id);

            if (layer.incoming) {
                await config.models.LayerIncoming.delete(req.params.layerid);
            }

            if (layer.outgoing) {
                await config.models.LayerOutgoing.delete(req.params.layerid);
            }

            config.events.delete(layer.id);

            await config.models.Layer.delete(req.params.layerid);

            res.json({
                status: 200,
                message: 'Layer Deleted'
            });
        } catch (err) {
            Err.respond(err, res);
        }
    });
}

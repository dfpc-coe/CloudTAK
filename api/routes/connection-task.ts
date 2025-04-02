import { Type } from '@sinclair/typebox'
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import CF from '../lib/aws/cloudformation.js';
import Lambda from '../lib/aws/lambda.js';
import CloudFormation from '../lib/aws/cloudformation.js';
import Logs from '../lib/aws/lambda-logs.js';
import Cacher from '../lib/cacher.js';
import Config from '../lib/config.js';
import { Capabilities } from '@tak-ps/etl'
import { StandardResponse, JobLogResponse } from '../lib/types.js';

export default async function router(schema: Schema, config: Config) {
    await schema.get('/connection/:connectionid/layer/:layerid/task', {
        name: 'Task Status',
        group: 'Task',
        params: Type.Object({
            connectionid: Type.Integer(),
            layerid: Type.Integer(),
        }),
        description: 'Get the status of a task stack in relation to a given layer',
        res: Type.Object({
            status: Type.String()
        })
    }, async (req, res) => {
        try {
            const { connection } = await Auth.is_connection(config, req, {
                resources: []
            }, req.params.connectionid);

            const layer = await config.cacher.get(Cacher.Miss(req.query, `layer-${req.params.layerid}`), async () => {
                return await config.models.Layer.augmented_from(parseInt(String(req.params.layerid)));
            });

            if (layer.connection !== connection.id) {
                throw new Err(400, null, 'Layer does not belong to this connection');
            }

            res.json(await CF.status(config, layer.id));
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.delete('/connection/:connectionid/layer/:layerid/task', {
        name: 'Cancel Update',
        group: 'Task',
        params: Type.Object({
            connectionid: Type.Integer(),
            layerid: Type.Integer(),
        }),
        description: 'If a stack is currently updating, cancel the stack update',
        res: StandardResponse
    }, async (req, res) => {
        try {
            const { connection } = await Auth.is_connection(config, req, {
                resources: []
            }, req.params.connectionid);

            const layer = await config.cacher.get(Cacher.Miss(req.query, `layer-${req.params.layerid}`), async () => {
                return await config.models.Layer.augmented_from(parseInt(String(req.params.layerid)));
            });

            if (layer.connection !== connection.id) {
                throw new Err(400, null, 'Layer does not belong to this connection');
            }

            await CF.cancel(config, layer.id);

            res.json({
                status: 200,
                message: 'Stack Update Cancelled'
            });
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.post('/connection/:connectionid/layer/:layerid/task/invoke', {
        name: 'Run Task',
        group: 'Task',
        params: Type.Object({
            connectionid: Type.Integer(),
            layerid: Type.Integer(),
        }),
        description: 'Manually invoke a Task',
        res: StandardResponse
    }, async (req, res) => {
        try {
            const { connection } = await Auth.is_connection(config, req, {
                resources: []
            }, req.params.connectionid);

            const layer = await config.cacher.get(Cacher.Miss(req.query, `layer-${req.params.layerid}`), async () => {
                return await config.models.Layer.augmented_from(parseInt(String(req.params.layerid)));
            });

            if (layer.connection !== connection.id) {
                throw new Err(400, null, 'Layer does not belong to this connection');
            }

            await Lambda.invoke(config, layer.id)

            res.json({
                status: 200,
                message: 'Manually Invoked Lambda'
            });
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.get('/connection/:connectionid/layer/:layerid/task/logs', {
        name: 'Task Logs',
        group: 'Task',
        params: Type.Object({
            connectionid: Type.Integer(),
            layerid: Type.Integer(),
        }),
        description: 'Get the logs related to the given task',
        res: Type.Object({
            logs: Type.Array(JobLogResponse)
        })
    }, async (req, res) => {
        try {
            const { connection } = await Auth.is_connection(config, req, {
                resources: []
            }, req.params.connectionid);

            const layer = await config.cacher.get(Cacher.Miss(req.query, `layer-${req.params.layerid}`), async () => {
                return await config.models.Layer.augmented_from(parseInt(String(req.params.layerid)));
            });

            if (layer.connection !== connection.id) {
                throw new Err(400, null, 'Layer does not belong to this connection');
            }

            res.json(await Logs.list(config, layer));
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.get('/connection/:connectionid/layer/:layerid/task/capabilities', {
        name: 'Task Capabilities',
        group: 'Task',
        params: Type.Object({
            connectionid: Type.Integer(),
            layerid: Type.Integer(),
        }),
        description: 'Get the Capabilities object',
        res: Capabilities
    }, async (req, res) => {
        try {
            const { connection } = await Auth.is_connection(config, req, {
                resources: []
            }, req.params.connectionid);

            const layer = await config.cacher.get(Cacher.Miss(req.query, `layer-${req.params.layerid}`), async () => {
                return await config.models.Layer.augmented_from(parseInt(String(req.params.layerid)));
            });

            if (layer.connection !== connection.id) {
                throw new Err(400, null, 'Layer does not belong to this connection');
            }

            const capabilities = await Lambda.capabilities(config, layer.id);

            res.json(capabilities);
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.post('/connection/:connectionid/layer/:layerid/task', {
        name: 'Task Deploy',
        group: 'Task',
        params: Type.Object({
            connectionid: Type.Integer(),
            layerid: Type.Integer(),
        }),
        description: 'Deploy a task stack',
        res: Type.Object({
            status: Type.String()
        })
    }, async (req, res) => {
        try {
            const { connection } = await Auth.is_connection(config, req, {
                resources: []
            }, req.params.connectionid);

            const layer = await config.cacher.get(Cacher.Miss(req.query, `layer-${req.params.layerid}`), async () => {
                return await config.models.Layer.augmented_from(parseInt(String(req.params.layerid)));
            });

            if (layer.connection !== connection.id) {
                throw new Err(400, null, 'Layer does not belong to this connection');
            }

            try {
                await Logs.delete(config, layer);
            } catch (err) {
                console.log('no existing log groups', err);
            }

            const lambda = await Lambda.generate(config, layer);
            await CloudFormation.create(config, layer.id, lambda);

            res.json(await CF.status(config, layer.id));
        } catch (err) {
            Err.respond(err, res);
        }
    });
}

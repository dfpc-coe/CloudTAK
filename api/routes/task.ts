import { Type } from '@sinclair/typebox'
import { sql } from 'drizzle-orm';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import ECR from '../lib/aws/ecr.js';
import CF from '../lib/aws/cloudformation.js';
import Lambda from '../lib/aws/lambda.js';
import CloudFormation from '../lib/aws/cloudformation.js';
import Logs from '../lib/aws/lambda-logs.js';
import semver from 'semver-sort';
import Cacher from '../lib/cacher.js';
import Config from '../lib/config.js';
import { StandardResponse, JobLogResponse } from '../lib/types.js';

export enum TaskSchemaEnum {
    OUTPUT = 'schema:output',
    INPUT = 'schema:input'
}

async function listTasks(): Promise<{
    total: number,
    tasks: Map<string, Array<string>>
}> {
    const images = await ECR.list();

    let total: number = 0;
    const tasks: Map<string, Array<string>> = new Map();

    for (const image of images) {
        const match = String(image.imageTag).match(/^(.*)-v([0-9]+\.[0-9]+\.[0-9]+)$/);
        if (!match) continue;
        total++;
        if (!tasks.has(match[1])) tasks.set(match[1], []);
        tasks.get(match[1]).push(match[2]);
    }

    const taskarr = new Array()
    for (const key of tasks.keys()) {
        tasks.set(key, semver.desc(tasks.get(key)));
    }

    return { total, tasks }
}

export default async function router(schema: Schema, config: Config) {
    await schema.get('/task', {
        name: 'List Tasks',
        group: 'Task',
        description: 'List Tasks',
        res: Type.Object({
            total: Type.Integer(),
            items: Type.Any()
        })
    }, async (req, res) => {
        try {
            await Auth.is_auth(config, req);

            const { total, tasks } = await listTasks();

            return res.json({
                total,
                items: Object.fromEntries(tasks)
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.get('/task/:task', {
        name: 'List Tasks',
        group: 'Task',
        params: Type.Object({
            task: Type.String(),
        }),
        description: 'List Version for a specific task',
        res: Type.Object({
            total: Type.Integer(),
            versions: Type.Array(Type.Any())
        })
    }, async (req, res) => {
        try {
            await Auth.is_auth(config, req);

            // Stuck with this approach for now - https://github.com/aws/containers-roadmap/issues/418
            const { total, tasks } = await listTasks();

            return res.json({
                total: tasks.get(req.params.task).length || 0,
                versions: semver.desc(tasks.get(req.params.task) || [])
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.delete('/task/:task/version/:version', {
        name: 'Delete Version',
        group: 'Task',
        params: Type.Object({
            task: Type.String(),
            version: Type.String(),
        }),
        description: 'Delete a given task version',
        res: StandardResponse
    }, async (req, res) => {
        try {
            await Auth.is_auth(config, req);

            const { total, tasks } = await listTasks();

            const versions = tasks.get(req.params.task);
            if (!versions) throw new Err(400, null, 'Task does not exist');
            if (!versions.includes(req.params.version)) throw new Err(400, null, 'Task Version does not exist');

            const task = `${req.params.task}-v${req.params.version}`;
            const layers = await config.models.Layer.list({
                limit: 1,
                where: sql`
                    task = ${task}::TEXT
                `
            });

            if (layers.total !== 0) throw new Err(400, null, 'Cannot delete a layer that is in use');

            await ECR.delete(req.params.task, req.params.version);

            return res.json({
                status: 200,
                message: 'Deleted Task Version'
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.get('/layer/:layerid/task', {
        name: 'Task Status',
        group: 'Task',
        params: Type.Object({
            layerid: Type.Integer(),
        }),
        description: 'Get the status of a task stack in relation to a given layer',
        res: Type.Object({
            status: Type.String()
        })
    }, async (req, res) => {
        try {
            await Auth.is_auth(config, req);

            const layer = await config.cacher.get(Cacher.Miss(req.query, `layer-${req.params.layerid}`), async () => {
                return await config.models.Layer.from(parseInt(String(req.params.layerid)));
            });

            return res.json(await CF.status(config, layer.id));
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.delete('/layer/:layerid/task', {
        name: 'Cancel Update',
        group: 'Task',
        params: Type.Object({
            layerid: Type.Integer(),
        }),
        description: 'If a stack is currently updating, cancel the stack update',
        res: StandardResponse
    }, async (req, res) => {
        try {
            await Auth.is_auth(config, req);

            const layer = await config.cacher.get(Cacher.Miss(req.query, `layer-${req.params.layerid}`), async () => {
                return await config.models.Layer.from(parseInt(String(req.params.layerid)));
            });

            await CF.delete(config, layer.id);

            return res.json({
                status: 200,
                message: 'Stack Update Cancelled'
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.post('/layer/:layerid/task/invoke', {
        name: 'Run Task',
        group: 'Task',
        params: Type.Object({
            layerid: Type.Integer(),
        }),
        description: 'Manually invoke a Task',
        res: StandardResponse
    }, async (req, res) => {
        try {
            await Auth.is_auth(config, req);

            const layer = await config.cacher.get(Cacher.Miss(req.query, `layer-${req.params.layerid}`), async () => {
                return await config.models.Layer.from(parseInt(String(req.params.layerid)));
            });

            await Lambda.invoke(config, layer.id)

            return res.json({
                status: 200,
                message: 'Manually Invoked Lambda'
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.get('/layer/:layerid/task/logs', {
        name: 'Task Logs',
        group: 'Task',
        params: Type.Object({
            layerid: Type.Integer(),
        }),
        description: 'Get the logs related to the given task',
        res: Type.Object({
            logs: Type.Array(JobLogResponse)
        })
    }, async (req, res) => {
        try {
            await Auth.is_auth(config, req);

            const layer = await config.cacher.get(Cacher.Miss(req.query, `layer-${req.params.layerid}`), async () => {
                return await config.models.Layer.from(parseInt(String(req.params.layerid)));
            });

            return res.json(await Logs.list(config, layer));
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.get('/layer/:layerid/task/schema', {
        name: 'Task Schema',
        group: 'Task',
        params: Type.Object({
            layerid: Type.Integer(),
        }),
        description: 'Get the JSONSchema for the expected environment variables',
        query: Type.Object({
            type: Type.Enum(TaskSchemaEnum, {
                default: TaskSchemaEnum.INPUT
            })
        }),
        res: Type.Object({
            schema: Type.Any()
        })
    }, async (req, res) => {
        try {
            await Auth.is_auth(config, req);

            const layer = await config.cacher.get(Cacher.Miss(req.query, `layer-${req.params.layerid}`), async () => {
                return await config.models.Layer.from(parseInt(String(req.params.layerid)));
            });

            return res.json({
                schema: await Lambda.schema(config, layer.id, String(req.query.type))
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.post('/layer/:layerid/task', {
        name: 'Task Deploy',
        group: 'Task',
        params: Type.Object({
            layerid: Type.Integer(),
        }),
        description: 'Deploy a task stack',
        res: Type.Object({
            status: Type.String()
        })
    }, async (req, res) => {
        try {
            await Auth.is_auth(config, req);

            const layer = await config.cacher.get(Cacher.Miss(req.query, `layer-${req.params.layerid}`), async () => {
                return await config.models.Layer.from(parseInt(String(req.params.layerid)));
            });

            try {
                await Logs.delete(config, layer);
            } catch (err) {
                console.log('no existing log groups');
            }

            const lambda = await Lambda.generate(config, layer);
            await CloudFormation.create(config, layer.id, lambda);

            return res.json(await CF.status(config, layer.id));
        } catch (err) {
            return Err.respond(err, res);
        }
    });
}

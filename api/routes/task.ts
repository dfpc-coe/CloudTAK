import { Type } from '@sinclair/typebox'
import { sql } from 'drizzle-orm';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import ECR from '../lib/aws/ecr.js';
import semver from 'semver-sort';
import Config from '../lib/config.js';
import { Task } from '../lib/schema.js';
import { StandardResponse, TaskResponse } from '../lib/types.js';
import * as Default from '../lib/limits.js';

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
        query: Type.Object({
            limit: Default.Limit,
            page: Default.Page,
            order: Default.Order,
            sort: Type.Optional(Type.String({ default: 'created', enum: Object.keys(Task) })),
            filter: Default.Filter
        }),
        res: Type.Object({
            total: Type.Integer(),
            items: Type.Array(TaskResponse)
        })
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req);

            const list = await config.models.Task.list({
                limit: req.query.limit,
                page: req.query.page,
                order: req.query.order,
                sort: req.query.sort,
                where: sql`
                    name ~* ${req.query.filter}
                `
            });

            return res.json(list);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.post('/task', {
        name: 'Create Task',
        group: 'Task',
        description: 'Create Registered Task',
        body: Type.Object({
            name: Type.String(),
            prefix: Type.String(),
            repo: Type.Optional(Type.String()),
            readme: Type.Optional(Type.String()),
        }),
        res: TaskResponse
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req);

            const task = await config.models.Task.generate(req.body);

            return res.json(task);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.get('/task/raw', {
        name: 'List Tasks',
        group: 'RawTask',
        description: 'List Tasks',
        res: Type.Object({
            total: Type.Integer(),
            items: Type.Any()
        })
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req);

            const { total, tasks } = await listTasks();

            return res.json({
                total,
                items: Object.fromEntries(tasks)
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.get('/task/raw/:task', {
        name: 'Get Task',
        group: 'RawTask',
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
            await Auth.as_user(config, req);

            // Stuck with this approach for now - https://github.com/aws/containers-roadmap/issues/418
            const { tasks } = await listTasks();

            return res.json({
                total: tasks.get(req.params.task).length || 0,
                versions: semver.desc(tasks.get(req.params.task) || [])
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.delete('/task/raw/:task/version/:version', {
        name: 'Delete Version',
        group: 'RawTask',
        params: Type.Object({
            task: Type.String(),
            version: Type.String(),
        }),
        description: 'Delete a given task version',
        res: StandardResponse
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req);

            const { tasks } = await listTasks();

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

    await schema.get('/task/prefix/:prefix/readme', {
        name: 'Task README',
        group: 'Task',
        description: 'Return README Contents',
        params: Type.Object({
            prefix: Type.String()
        }),
        res: Type.Object({
            body: Type.String()
        })
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req);

            const task = await config.models.Task.from(req.params.prefix);

            if (task.readme) {
                const readmeres = await fetch(task.readme);
                return res.json({
                    body: await readmeres.text()
                })
            } else {
                return res.json({ body: '' });
            }
        } catch (err) {
            return Err.respond(err, res);
        }
    });
}

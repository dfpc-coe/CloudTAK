import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.ts';
import ECR from '../lib/aws/ecr.ts';
import CF from '../lib/aws/cloudformation.ts';
import Lambda from '../lib/aws/lambda.ts';
import CloudFormation from '../lib/aws/cloudformation.ts';
import Logs from '../lib/aws/lambda-logs.ts';
import Modeler from '../lib/drizzle.ts';
import { Layer } from '../lib/schema.ts';
import semver from 'semver-sort';
import Cacher from '../lib/cacher.ts';
import Config from '../lib/config.ts';
import { Response } from 'express';
import { AuthRequest } from '@tak-ps/blueprint-login';

export default async function router(schema: any, config: Config) {
    const LayerModel = new Modeler(config.pg, Layer);

    await schema.get('/task', {
        name: 'List Tasks',
        group: 'Task',
        auth: 'user',
        description: 'List Tasks',
        res: 'res.ListTasks.json'
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(req);

            const images = await ECR.list();

            let total: number = 0;
            const tasks = new Map();

            for (const image of images.imageIds) {
                const match = image.imageTag.match(/^(.*)-v([0-9]+\.[0-9]+\.[0-9]+)$/);
                if (!match) continue;
                total++;
                if (!tasks.has(match[1])) tasks.set(match[1], []);
                tasks.get(match[1]).push(match[2]);
            }

            const taskarr = new Array()
            for (const key of tasks.keys()) {
                tasks.set(key, semver.desc(tasks.get(key)));
            }

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
        auth: 'user',
        ':task': 'string',
        description: 'List Version for a specific task',
        res: 'res.ListTaskVersions.json'
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(req);

            // Stuck with this approach for now - https://github.com/aws/containers-roadmap/issues/418
            const images = await ECR.list();

            let total: number = 0;
            const tasks = new Map();

            for (const image of images.imageIds) {
                const match = image.imageTag.match(/^(.*)-v([0-9]+\.[0-9]+\.[0-9]+)$/);
                if (!match) continue;
                total++;
                if (!tasks.has(match[1])) tasks.set(match[1], []);
                tasks.get(match[1]).push(match[2]);
            }

            return res.json({
                total: tasks.get(req.params.task).length || 0,
                versions: semver.desc(tasks.get(req.params.task) || [])
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.get('/layer/:layerid/task', {
        name: 'Task Status',
        group: 'Task',
        auth: 'user',
        ':layerid': 'integer',
        description: 'Get the status of a task stack in relation to a given layer',
        res: 'res.TaskStatus.json'
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(req);

            const layer = await config.cacher.get(Cacher.Miss(req.query, `layer-${req.params.layerid}`), async () => {
                return await LayerModel.from(parseInt(String(req.params.layerid)));
            });

            return res.json(await CF.status(config, layer.id));
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.post('/layer/:layerid/task/invoke', {
        name: 'Run Task',
        group: 'Task',
        auth: 'user',
        ':layerid': 'integer',
        description: 'Manually invoke a Task',
        res: 'res.Standard.json'
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(req);

            const layer = await config.cacher.get(Cacher.Miss(req.query, `layer-${req.params.layerid}`), async () => {
                return await LayerModel.from(parseInt(String(req.params.layerid)));
            });

            await Lambda.invoke(config, layer.id)

            return res.json({
                status: 200,
                message: 'Manually Invoked Lambda'
            });

            return res.json(await CF.status(config, layer.id));
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.get('/layer/:layerid/task/logs', {
        name: 'Task Logs',
        group: 'Task',
        auth: 'user',
        ':layerid': 'integer',
        description: 'Get the logs related to the given task',
        res: 'res.TaskLogs.json'
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(req);

            const layer = await config.cacher.get(Cacher.Miss(req.query, `layer-${req.params.layerid}`), async () => {
                return await LayerModel.from(parseInt(String(req.params.layerid)));
            });

            return res.json(await Logs.list(config, layer));
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.get('/layer/:layerid/task/schema', {
        name: 'Task Schema',
        group: 'Task',
        auth: 'user',
        ':layerid': 'integer',
        description: 'Get the JSONSchema for the expected environment variables',
        query: 'req.query.TaskSchema.json',
        res: 'res.TaskSchema.json'
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(req);

            const layer = await config.cacher.get(Cacher.Miss(req.query, `layer-${req.params.layerid}`), async () => {
                return await LayerModel.from(parseInt(String(req.params.layerid)));
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
        auth: 'user',
        ':layerid': 'integer',
        description: 'Deploy a task stack',
        res: 'res.TaskStatus.json'
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(req);

            const layer = await config.cacher.get(Cacher.Miss(req.query, `layer-${req.params.layerid}`), async () => {
                return await LayerModel.from(parseInt(String(req.params.layerid)));
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

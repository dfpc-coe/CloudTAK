import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import ECR from '../lib/aws/ecr.js';
import CF from '../lib/aws/cloudformation.js';
import Lambda from '../lib/aws/lambda.js';
import CloudFormation from '../lib/aws/cloudformation.js';
import Logs from '../lib/aws/logs.js';

// @ts-ignore
import Layer from '../lib/types/layer.js';
import semver from 'semver-sort';
import Cacher from '../lib/cacher.js';
// @ts-ignore
import LayerLive from '../lib/types/layers_live.js';
// @ts-ignore
import LayerFile from '../lib/types/layers_file.js';
import Config from '../lib/config.js';
import { Request, Response } from 'express';

export default async function router(schema: any, config: Config) {
    await schema.get('/task', {
        name: 'List Tasks',
        group: 'Task',
        auth: 'user',
        description: 'List Tasks',
        res: 'res.ListTasks.json'
    }, async (req: Request, res: Response) => {
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
                tasks: Object.fromEntries(tasks)
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
    }, async (req: Request, res: Response) => {
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
    }, async (req: Request, res: Response) => {
        try {
            await Auth.is_auth(req);

            const layer = await config.cacher.get(Cacher.Miss(req.query, `layer-${req.params.layerid}`), async () => {
                const layer = (await Layer.from(config.pool, req.params.layerid)).serialize();
                layer.data = (layer.mode === 'file' ? await LayerFile.from(config.pool, layer.id, { column: 'layer_id' }) : await LayerLive.from(config.pool, layer.id, { column: 'layer_id' })).serialize();
                return layer;
            });

            if (layer.mode === 'file') throw new Err(400, null, 'File Layers don\'t have associated stacks');

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
    }, async (req: Request, res: Response) => {
        try {
            await Auth.is_auth(req);

            const layer = await config.cacher.get(Cacher.Miss(req.query, `layer-${req.params.layerid}`), async () => {
                const layer = (await Layer.from(config.pool, req.params.layerid)).serialize();
                layer.data = (layer.mode === 'file' ? await LayerFile.from(config.pool, layer.id, { column: 'layer_id' }) : await LayerLive.from(config.pool, layer.id, { column: 'layer_id' })).serialize();
                return layer;
            });

            if (layer.mode === 'file') throw new Err(400, null, 'File Layers don\'t have associated stacks');

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
        res: 'res.TaskSchema.json'
    }, async (req: Request, res: Response) => {
        try {
            await Auth.is_auth(req);

            const layer = await config.cacher.get(Cacher.Miss(req.query, `layer-${req.params.layerid}`), async () => {
                const layer = (await Layer.from(config.pool, req.params.layerid)).serialize();
                layer.data = (layer.mode === 'file' ? await LayerFile.from(config.pool, layer.id, { column: 'layer_id' }) : await LayerLive.from(config.pool, layer.id, { column: 'layer_id' })).serialize();
                return layer;
            });

            if (layer.mode === 'file') throw new Err(400, null, 'File Layers don\'t have associated stacks');

            return res.json({
                schema: await Lambda.schema(config, layer.id)
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
    }, async (req: Request, res: Response) => {
        try {
            await Auth.is_auth(req);

            const layer = await config.cacher.get(Cacher.Miss(req.query, `layer-${req.params.layerid}`), async () => {
                const layer = (await Layer.from(config.pool, req.params.layerid)).serialize();
                layer.data = (layer.mode === 'file' ? await LayerFile.from(config.pool, layer.id, { column: 'layer_id' }) : await LayerLive.from(config.pool, layer.id, { column: 'layer_id' })).serialize();
                return layer;
            });

            try {
                await Logs.delete(config, layer);
            } catch (err) {
                console.log('no existing log groups');
            }

            if (layer.mode === 'file') throw new Err(400, null, 'File Layers don\'t have associated stacks');
            const lambda = await Lambda.generate(config, layer, layer.data);
            await CloudFormation.create(config, layer.id, lambda);

            return res.json(await CF.status(config, layer.id));
        } catch (err) {
            return Err.respond(err, res);
        }
    });
}

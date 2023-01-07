import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import ECR from '../lib/aws/ecr.js';
import Layer from '../lib/types/layer.js';
import semver from 'semver-sort';
import CF from '../lib/aws/cloudformation.js';
import Cacher from '../lib/cacher.js';
import Lambda from '../lib/aws/lambda.js';
import CloudFormation from '../lib/aws/cloudformation.js';

export default async function router(schema, config) {
    await schema.get('/task', {
        name: 'List Tasks',
        group: 'Task',
        auth: 'user',
        description: 'List Tasks',
        res: 'res.ListTasks.json'
    }, async (req, res) => {
        try {
            await Auth.is_auth(req);

            const images = await ECR.list();

            const list = {
                total: {},
                tasks: {}
            };

            for (const image of images.imageIds) {
                const match = image.imageTag.match(/^(.*)-v([0-9]+\.[0-9]+\.[0-9]+)$/);
                if (!match) continue;
                list.total++;
                if (!list.tasks[match[1]]) list.tasks[match[1]] = [];
                list.tasks[match[1]].push(match[2]);
            }

            for (const key in list.tasks) {
                list.tasks[key] = semver.desc(list.tasks[key]);
            }

            return res.json(list);
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
    }, async (req, res) => {
        try {
            await Auth.is_auth(req);

            const layer = await config.cacher.get(Cacher.Miss(req.query, `layer-${req.params.layerid}`), async () => {
                const layer = (await Layer.from(config.pool, req.params.layerid)).serialize();
                layer.data = (layer.mode === 'file' ? await LayerFile.from(config.pool, layer.id, { column: 'layer_id' }) : await LayerLive.from(config.pool, layer.id, { column: 'layer_id' })).serialize();
                return layer;
            });

            if (layer.mode === 'file') throw new Err(400, null, 'File Layers don\'t have associated stacks');

            return res.json(await CF.status(config, layer));
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
    }, async (req, res) => {
        try {
            await Auth.is_auth(req);

            const layer = await config.cacher.get(Cacher.Miss(req.query, `layer-${req.params.layerid}`), async () => {
                const layer = (await Layer.from(config.pool, req.params.layerid)).serialize();
                layer.data = (layer.mode === 'file' ? await LayerFile.from(config.pool, layer.id, { column: 'layer_id' }) : await LayerLive.from(config.pool, layer.id, { column: 'layer_id' })).serialize();
                return layer;
            });

            if (layer.mode === 'file') throw new Err(400, null, 'File Layers don\'t have associated stacks');
            const lambda = await Lambda.generate(config, layer, layer.data);
            await CloudFormation.create(config, layer, lambda);

            return res.json(await CF.status(config, layer));
        } catch (err) {
            return Err.respond(err, res);
        }
    });
}

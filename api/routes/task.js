import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import ECR from '../lib/aws/ecr.js';
import semver from 'semver-sort';

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
                list.tasks[key] = semver.desc(list.tasks[key])
            }

            return res.json(list);
        } catch (err) {
            return Err.respond(err, res);
        }
    });
}

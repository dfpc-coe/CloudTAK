import { Static, Type } from '@sinclair/typebox'
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import Config from '../lib/config.js';
import EC2 from '../lib/aws/ec2.js';
import ECSVideo from '../lib/aws/ecs-video.js';
import { StandardResponse, VideoResponse } from '../lib/types.js';

export default async function router(schema: Schema, config: Config) {
    const video = new ECSVideo(config);

    await schema.get('/video', {
        name: 'List Video Servers',
        group: 'Video',
        description: 'Let Admins list video servers',
        res: Type.Object({
            total: Type.Integer(),
            versions: Type.Array(Type.Integer()),
            items: Type.Array(VideoResponse)
        })
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req, { admin: true });

            const versions = await video.definitions();

            if (!versions.length) {
                return res.json({ total: 0, versions: [], items: [] });
            }

            const items = await video.tasks();

            const list = {
                total: items.length,
                versions,
                items: []
            };

            for (const item of items) {
                const i: Static<typeof VideoResponse> = {
                    id: item.taskArn.replace(/.*\//, ''),
                    version: Number(item.taskDefinitionArn.replace(/.*:/, '')),
                    created: (item.startedAt ?? new Date()).toISOString(),
                    status: item.lastStatus,
                    statusDesired: item.desiredStatus,
                    memory: Number(item.memory),
                    cpu: Number(item.cpu)
                }

                list.items.push(i);
            }

            return res.json(list);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.get('/video/:serverid', {
        name: 'Get Server',
        group: 'Video',
        description: 'Get all info about a particular video server',
        params: Type.Object({
            serverid: Type.String()
        }),
        res: VideoResponse
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req, { admin: true });

            const item = await video.task(req.params.serverid);

            const i: Static<typeof VideoResponse> = {
                id: item.taskArn.replace(/.*\//, ''),
                version: Number(item.taskDefinitionArn.replace(/.*:/, '')),
                created: (item.startedAt ?? new Date()).toISOString(),
                status: item.lastStatus,
                statusDesired: item.desiredStatus,
                memory: Number(item.memory),
                cpu: Number(item.cpu)
            }

            if (i.status === "RUNNING" && i.statusDesired === "RUNNING") {
                for (const att of item.attachments) {
                    for (const det of att.details) {
                        if (det.name === 'networkInterfaceId') {
                            i.ipPublic = await EC2.eni(det.value);
                        } else if (det.name === 'privateIPv4Address') {
                            i.ipPrivate = det.value;
                        }
                    }
                }
            }

            return res.json(i);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.delete('/video/:serverid', {
        name: 'Delete Server',
        group: 'Video',
        description: 'Shut down an existing video server',
        params: Type.Object({
            serverid: Type.String()
        }),
        res: StandardResponse
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req, { admin: true });

            await video.delete(req.params.serverid);

            return res.json({
                status: 200,
                message: 'Deleting Server',
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });
}

import { Static, Type } from '@sinclair/typebox'
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import Config from '../lib/config.js';
import EC2 from '../lib/aws/ec2.js';
import ECSVideo from '../lib/aws/ecs-video.js';
import ECSVideoControl, { Configuration, VideoConfigUpdate, PathConfig } from '../lib/control/video-service.js';
import { StandardResponse, VideoResponse } from '../lib/types.js';

export default async function router(schema: Schema, config: Config) {
    const video = new ECSVideo(config);
    const videoControl = new ECSVideoControl(config);

    await schema.get('/video/service', {
        name: 'Video Service',
        group: 'VideoService',
        description: 'Get Video Service Configuration',
        res: Configuration
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req, { admin: true });

            const configuration = await videoControl.configuration();

            res.json(configuration);
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.patch('/video/service', {
        name: 'Update Service',
        group: 'VideoService',
        description: 'Get Video Service Configuration',
        body: VideoConfigUpdate,
        res: Configuration
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req, { admin: true });

            const configuration = await videoControl.configure(req.body);

            res.json(configuration);
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.get('/video/server', {
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
                res.json({ total: 0, versions: [], items: [] });
            } else {
                const items = await video.tasks();

                const list: {
                    total: number;
                    versions: number[]
                    items: Array<Static<typeof VideoResponse>>
                } = {
                    total: items.length,
                    versions,
                    items: []
                };

                for (const item of items) {
                    if (!item.taskArn) throw new Err(500, null, 'Video TaskARN is not defined');
                    if (!item.taskDefinitionArn) throw new Err(500, null, 'Video TaskDefinitionARN is not defined');

                    const i: Static<typeof VideoResponse> = {
                        id: item.taskArn.replace(/.*\//, ''),
                        version: Number(item.taskDefinitionArn.replace(/.*:/, '')),
                        created: (item.startedAt ?? new Date()).toISOString(),
                        status: item.lastStatus || '',
                        statusDesired: item.desiredStatus || 'UNKNOWN',
                        memory: Number(item.memory),
                        cpu: Number(item.cpu)
                    }

                    list.items.push(i);
                }

                res.json(list);
            }
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.get('/video/service/path/:path', {
        name: 'Video Paths',
        group: 'VideoService',
        description: 'Get information about a given path',
        params: Type.Object({
            path: Type.String()
        }),
        res: PathConfig
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req, { admin: true });

            const path = await videoControl.pathConfig(req.params.path)

            res.json(path);
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.post('/video/server', {
        name: 'Create Server',
        group: 'Video',
        description: 'Create a new Media Server',
        body: Type.Object({}),
        res: VideoResponse
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req, { admin: true });

            const item = await video.run();

            if (!item.taskArn) throw new Err(500, null, 'Video TaskARN is not defined');
            if (!item.taskDefinitionArn) throw new Err(500, null, 'Video TaskDefinitionARN is not defined');

            const i: Static<typeof VideoResponse> = {
                id: item.taskArn.replace(/.*\//, ''),
                version: Number(item.taskDefinitionArn.replace(/.*:/, '')),
                created: (item.startedAt ?? new Date()).toISOString(),
                status: item.lastStatus || '',
                statusDesired: item.desiredStatus || 'UNKNOWN',
                memory: Number(item.memory),
                cpu: Number(item.cpu)
            }

            res.json(i);
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.get('/video/server/:serverid', {
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

            if (!item.taskArn) throw new Err(500, null, 'Video TaskARN is not defined');
            if (!item.taskDefinitionArn) throw new Err(500, null, 'Video TaskDefinitionARN is not defined');

            const i: Static<typeof VideoResponse> = {
                id: item.taskArn.replace(/.*\//, ''),
                version: Number(item.taskDefinitionArn.replace(/.*:/, '')),
                created: (item.startedAt ?? new Date()).toISOString(),
                status: item.lastStatus || '',
                statusDesired: item.desiredStatus || 'UNKNOWN',
                memory: Number(item.memory),
                cpu: Number(item.cpu)
            }

            if (i.status === "RUNNING" && i.statusDesired === "RUNNING") {
                for (const att of item.attachments || []) {
                    for (const det of (att.details) || []) {
                        if (det.name === 'networkInterfaceId' && det.value) {
                            i.ipPublic = (await EC2.eni(det.value)) || undefined;
                        } else if (det.name === 'privateIPv4Address') {
                            i.ipPrivate = det.value;
                        }
                    }
                }
            }

            res.json(i);
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.delete('/video/server/:serverid', {
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

            res.json({
                status: 200,
                message: 'Deleting Server',
            });
        } catch (err) {
            Err.respond(err, res);
        }
    });
}

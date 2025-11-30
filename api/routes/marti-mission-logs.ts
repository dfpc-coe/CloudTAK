import { Static, Type } from '@sinclair/typebox'
import { StandardResponse, GenericMartiResponse } from '../lib/types.js';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import { MissionOptions } from '@tak-ps/node-tak/lib/api/mission';
import { MissionLog } from '@tak-ps/node-tak/lib/api/mission-log';
import Auth from '../lib/auth.js';
import Config from '../lib/config.js';
import {
    TAKItem
} from '@tak-ps/node-tak/lib/api/types';
import { TAKAPI, APIAuthCertificate } from '@tak-ps/node-tak';

export default async function router(schema: Schema, config: Config) {
    await schema.get('/marti/missions/:name/log', {
        name: 'List Logs',
        group: 'MartiMissionLog',
        params: Type.Object({
            name: Type.String(),
        }),
        query: Type.Object({
            format: Type.String({
                default: 'json',
                enum: ['json', 'csv'],
                description: 'The response format to return'
            }),
            download: Type.Boolean({
                default: false,
                description: 'If set, the response will include a Content-Disposition Header'
            })
        }),
        description: 'Helper API to list Mission Logs',
        res: Type.Object({
            total: Type.Integer(),
            items: Type.Array(MissionLog)
        })
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const auth = (await config.models.Profile.from(user.email)).auth;
            const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(auth.cert, auth.key));

            const opts: Static<typeof MissionOptions> = req.headers['missionauthorization']
                ? { token: String(req.headers['missionauthorization']) }
                : await config.conns.subscription(user.email, req.params.name)

            const mission = await api.Mission.get(
                req.params.name,
                {
                    logs: true
                },
                opts
            );

            if (req.query.format === 'csv') {
                res.setHeader('Content-Type', 'text/csv');
                if (req.query.download) {
                    res.setHeader('Content-Disposition', `attachment; filename="mission-${req.params.name}-logs.csv"`);
                }

                const headers = ['id', 'dtg', 'creatorUid', 'content', 'keywords'];
                res.write(headers.join(',') + '\n');

                for (const log of (mission.logs || [])) {
                    const row = [
                        `"${log.id}"`,
                        `"${log.dtg}"`,
                        `"${log.creatorUid}"`,
                        `"${log.content.replace(/"/g, '""')}"`,
                        `"${(log.keywords || []).join(';').replace(/"/g, '""')}"`
                    ];

                    res.write(row.join(',') + '\n');
                }

                res.end();
            } else {
                if (req.query.download) {
                    res.setHeader('Content-Disposition', `attachment; filename="mission-${req.params.name}-logs.json"`);
                }

                res.json({
                    total: (mission.logs || []).length,
                    items: mission.logs || []
                });
            }
        } catch (err) {
             Err.respond(err, res);
        }
    });

    await schema.post('/marti/missions/:name/log', {
        name: 'Create Log',
        group: 'MartiMissionLog',
        params: Type.Object({
            name: Type.String(),
        }),
        description: 'Helper API to add a log to a mission',
        body: Type.Object({
            dtg: Type.Optional(Type.String({ format: 'date-time' })),
            content: Type.String(),
            keywords: Type.Optional(Type.Array(Type.String()))
        }),
        res: GenericMartiResponse
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const auth = (await config.models.Profile.from(user.email)).auth;
            const creatorUid = user.email;
            const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(auth.cert, auth.key));

            const opts: Static<typeof MissionOptions> = req.headers['missionauthorization']
                ? { token: String(req.headers['missionauthorization']) }
                : await config.conns.subscription(user.email, req.params.name)

            const log = await api.MissionLog.create(
                req.params.name,
                {
                    creatorUid: creatorUid,
                    dtg: req.body.dtg ?? new Date().toISOString(),
                    content: req.body.content,
                    keywords: req.body.keywords
                },
                opts
            );

            res.json(log);
        } catch (err) {
             Err.respond(err, res);
        }
    });

    await schema.patch('/marti/missions/:name/log/:logid', {
        name: 'Update Log',
        group: 'MartiMissionLog',
        params: Type.Object({
            name: Type.String(),
            logid: Type.String()
        }),
        description: 'Helper API to update a log on a mission',
        body: Type.Object({
            dtg: Type.String({
                format: 'date-time'
            }),
            content: Type.String(),
            keywords: Type.Optional(Type.Array(Type.String()))
        }),
        res: TAKItem(MissionLog)
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const auth = (await config.models.Profile.from(user.email)).auth;
            const creatorUid = user.email;
            const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(auth.cert, auth.key));

            const opts: Static<typeof MissionOptions> = req.headers['missionauthorization']
                ? { token: String(req.headers['missionauthorization']) }
                : await config.conns.subscription(user.email, req.params.name)

            const mission = await api.MissionLog.update(
                req.params.name,
                {
                    id: req.params.logid,
                    dtg: req.body.dtg,
                    creatorUid: creatorUid,
                    content: req.body.content,
                    keywords: req.body.keywords
                },
                opts
            );

            res.json(mission);
        } catch (err) {
             Err.respond(err, res);
        }
    });

    await schema.delete('/marti/missions/:name/log/:log', {
        name: 'Delete Log',
        group: 'MartiMissionLog',
        params: Type.Object({
            name: Type.String(),
            log: Type.String()
        }),
        description: 'Helper API to delete a log',
        res: StandardResponse
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const auth = (await config.models.Profile.from(user.email)).auth;
            const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(auth.cert, auth.key));

            const opts: Static<typeof MissionOptions> = req.headers['missionauthorization']
                ? { token: String(req.headers['missionauthorization']) }
                : await config.conns.subscription(user.email, req.params.name)

            await api.MissionLog.delete(
                req.params.log,
                opts
            );

            res.json({
                status: 200,
                message: 'Log Entry Deleted'
            });
        } catch (err) {
             Err.respond(err, res);
        }
    });
}

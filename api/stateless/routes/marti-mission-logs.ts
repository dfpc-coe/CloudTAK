import { Type } from '@sinclair/typebox';
import { StandardResponse, GenericMartiResponse } from '../../common/types.js';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import { MissionLog } from '@tak-ps/node-tak/lib/api/mission-log';
import type ConfigStateless from '../config.js';
import {
    TAKItem,
} from '@tak-ps/node-tak/lib/api/types';
import MissionControl from '../lib/control/mission.js';

export default async function router(schema: Schema, config: ConfigStateless) {
    const missionControl = new MissionControl(config);

    await schema.get('/marti/missions/:guid/log', {
        name: 'List Logs',
        group: 'MartiMissionLog',
        params: Type.Object({
            guid: Type.String(),
        }),
        query: Type.Object({
            format: Type.String({
                default: 'json',
                enum: ['json', 'csv'],
                description: 'The response format to return',
            }),
            download: Type.Boolean({
                default: false,
                description: 'If set, the response will include a Content-Disposition Header',
            }),
            token: Type.Optional(Type.String()),
        }),
        description: 'Helper API to list Mission Logs',
        res: Type.Object({
            total: Type.Integer(),
            items: Type.Array(MissionLog),
        }),
    }, async (req, res) => {
        try {
            const { api, opts } = await missionControl.context(req, req.params.guid, { token: true });

            const mission = await api.Mission.get(
                req.params.guid,
                {
                    logs: true,
                },
                opts,
            );

            if (req.query.format === 'csv') {
                res.setHeader('Content-Type', 'text/csv');
                if (req.query.download) {
                    res.setHeader('Content-Disposition', `attachment; filename="mission-${mission.name}-logs.csv"`);
                }

                const headers = ['id', 'dtg', 'creatorUid', 'content', 'keywords'];
                res.write(headers.join(',') + '\n');

                for (const log of (mission.logs || [])) {
                    const row = [
                        `"${log.id}"`,
                        `"${log.dtg}"`,
                        `"${log.creatorUid}"`,
                        `"${log.content.replace(/"/g, '""')}"`,
                        `"${(log.keywords || []).join(';').replace(/"/g, '""')}"`,
                    ];

                    res.write(row.join(',') + '\n');
                }

                res.end();
            } else {
                if (req.query.download) {
                    res.setHeader('Content-Disposition', `attachment; filename="mission-${mission.name}-logs.json"`);
                }

                res.json({
                    total: (mission.logs || []).length,
                    items: mission.logs || [],
                });
            }
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.post('/marti/missions/:guid/log', {
        name: 'Create Log',
        group: 'MartiMissionLog',
        params: Type.Object({
            guid: Type.String(),
        }),
        description: 'Helper API to add a log to a mission',
        body: Type.Object({
            dtg: Type.Optional(Type.String({ format: 'date-time' })),
            content: Type.String(),
            contentHashes: Type.Optional(Type.Array(Type.String())),
            entryUid: Type.Optional(Type.String()),
            keywords: Type.Optional(Type.Array(Type.String())),
        }),
        res: GenericMartiResponse,
    }, async (req, res) => {
        try {
            const { user, api, opts } = await missionControl.context(req, req.params.guid);
            const creatorUid = user.email;

            const log = await api.MissionLog.create(
                req.params.guid,
                {
                    creatorUid: creatorUid,
                    dtg: req.body.dtg ?? new Date().toISOString(),
                    content: req.body.content,
                    keywords: req.body.keywords,
                },
                opts,
            );

            res.json(log);
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.patch('/marti/missions/:guid/log/:logid', {
        name: 'Update Log',
        group: 'MartiMissionLog',
        params: Type.Object({
            guid: Type.String(),
            logid: Type.String(),
        }),
        description: 'Helper API to update a log on a mission',
        body: Type.Object({
            dtg: Type.String({
                format: 'date-time',
            }),
            contentHashes: Type.Optional(Type.Array(Type.String())),
            entryUid: Type.Optional(Type.String()),
            content: Type.String(),
            keywords: Type.Optional(Type.Array(Type.String())),
        }),
        res: TAKItem(MissionLog),
    }, async (req, res) => {
        try {
            const { user, api, opts } = await missionControl.context(req, req.params.guid);
            const creatorUid = user.email;

            const mission = await api.MissionLog.update(
                req.params.guid,
                {
                    id: req.params.logid,
                    dtg: req.body.dtg,
                    creatorUid: creatorUid,
                    content: req.body.content,
                    keywords: req.body.keywords,
                },
                opts,
            );

            res.json(mission);
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.delete('/marti/missions/:guid/log/:log', {
        name: 'Delete Log',
        group: 'MartiMissionLog',
        params: Type.Object({
            guid: Type.String(),
            log: Type.String(),
        }),
        description: 'Helper API to delete a log',
        res: StandardResponse,
    }, async (req, res) => {
        try {
            const { api, opts } = await missionControl.context(req, req.params.guid);

            await api.MissionLog.delete(
                req.params.log,
                opts,
            );

            res.json({
                status: 200,
                message: 'Log Entry Deleted',
            });
        } catch (err) {
            Err.respond(err, res);
        }
    });
}

import { Type } from '@sinclair/typebox';
import { StandardResponse } from '../../common/types.js';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import { MissionProperty } from '@tak-ps/node-tak/lib/api/mission-property';
import Auth from '../../common/auth.js';
import type ConfigStateless from '../config.js';
import {
    TAKItem,
} from '@tak-ps/node-tak/lib/api/types';
import MissionControl from '../lib/control/mission.js';

export default async function router(schema: Schema, config: ConfigStateless) {
    const missionControl = new MissionControl(config);

    await schema.get('/marti/missions/:guid/property', {
        name: 'List Properties',
        group: 'MartiMissionProperty',
        params: Type.Object({
            guid: Type.String(),
        }),
        query: Type.Object({
            prefix: Type.Optional(Type.String({
                description: 'Only return properties whose key starts with this prefix',
            })),
        }),
        description: 'Helper API to list Mission Key/Value Properties (TAK Server 5.9+)',
        res: Type.Object({
            total: Type.Integer(),
            items: Type.Array(MissionProperty),
        }),
        security: Auth.security('mission:read'),
    }, async (req, res) => {
        try {
            const { api, opts } = await missionControl.scoped(req, 'mission:read', req.params.guid);

            const list = await api.MissionProperty.list(
                req.params.guid,
                {
                    prefix: req.query.prefix,
                },
                opts,
            );

            res.json({
                total: list.data.length,
                items: list.data,
            });
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.get('/marti/missions/:guid/property/:key', {
        name: 'Get Property',
        group: 'MartiMissionProperty',
        params: Type.Object({
            guid: Type.String(),
            key: Type.String(),
        }),
        description: 'Helper API to get a single Mission Key/Value Property (TAK Server 5.9+)',
        res: TAKItem(MissionProperty),
        security: Auth.security('mission:read'),
    }, async (req, res) => {
        try {
            const { api, opts } = await missionControl.scoped(req, 'mission:read', req.params.guid);

            const property = await api.MissionProperty.get(
                req.params.guid,
                req.params.key,
                opts,
            );

            res.json(property);
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.put('/marti/missions/:guid/property', {
        name: 'Set Property',
        group: 'MartiMissionProperty',
        params: Type.Object({
            guid: Type.String(),
        }),
        description: 'Helper API to create or update (upsert) a Mission Key/Value Property (TAK Server 5.9+)',
        body: MissionProperty,
        res: TAKItem(MissionProperty),
        security: Auth.security('mission:update'),
    }, async (req, res) => {
        try {
            const { username, api, opts } = await missionControl.scoped(req, 'mission:update', req.params.guid);

            const property = await api.MissionProperty.set(
                req.params.guid,
                {
                    key: req.body.key,
                    value: req.body.value,
                    creatorUid: username,
                },
                opts,
            );

            res.json(property);
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.delete('/marti/missions/:guid/property/:key', {
        name: 'Delete Property',
        group: 'MartiMissionProperty',
        params: Type.Object({
            guid: Type.String(),
            key: Type.String(),
        }),
        description: 'Helper API to delete a single Mission Key/Value Property (TAK Server 5.9+)',
        res: StandardResponse,
        security: Auth.security('mission:update'),
    }, async (req, res) => {
        try {
            const { username, api, opts } = await missionControl.scoped(req, 'mission:update', req.params.guid);

            await api.MissionProperty.delete(
                req.params.guid,
                req.params.key,
                username,
                opts,
            );

            res.json({
                status: 200,
                message: 'Property Deleted',
            });
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.delete('/marti/missions/:guid/property', {
        name: 'Delete All Properties',
        group: 'MartiMissionProperty',
        params: Type.Object({
            guid: Type.String(),
        }),
        description: 'Helper API to delete all Mission Key/Value Properties (TAK Server 5.9+)',
        res: StandardResponse,
        security: Auth.security('mission:update'),
    }, async (req, res) => {
        try {
            const { username, api, opts } = await missionControl.scoped(req, 'mission:update', req.params.guid);

            await api.MissionProperty.deleteAll(
                req.params.guid,
                username,
                opts,
            );

            res.json({
                status: 200,
                message: 'Properties Deleted',
            });
        } catch (err) {
            Err.respond(err, res);
        }
    });
}

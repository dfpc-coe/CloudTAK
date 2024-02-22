import { Type } from '@sinclair/typebox'
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import { Response } from 'express';
import { AuthRequest } from '@tak-ps/blueprint-login';
import { type InferSelectModel } from 'drizzle-orm';
import { Data } from '../lib/schema.js';
import Config from '../lib/config.js';
import S3 from '../lib/aws/s3.js';
import { Param } from '@openaddresses/batch-generic';
import { sql, eq } from 'drizzle-orm';
import DataMission from '../lib/data-mission.js';
import { AuthResourceAccess } from '@tak-ps/blueprint-login';
import { StandardResponse } from '../lib/types.js';

export default async function router(schema: Schema, config: Config) {
    await schema.get('/data', {
        private: true,
        name: 'Internal List Data',
        group: 'Data',
        description: `
            Used by the frontend UI to list data packages that the user can visualize
        `,
        query: 'req.query.ListData.json',
        res: 'res.ListData.json'
    }, async (req, res) => {
        try {
            await Auth.is_auth(config.models, req);

            const list = await config.models.Data.list({
                limit: Number(req.query.limit),
                page: Number(req.query.page),
                order: String(req.query.order),
                sort: String(req.query.sort),
                where: sql`name ~* ${req.query.filter}`
            });

            res.json(list);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.get('/data/:dataid', {
        private: true,
        name: 'Internal Get Data',
        group: 'Data',
        description: `
            Events don't have the Connection ID but they have a valid data token
            This API allows a data token to request the data object and obtain the
            connectin Id for subsequent calls
        `,
        params: Type.Object({
            connectionid: Type.Integer()
            dataid: Type.Integer()
        }),
        res: 'res.Data.json'
    }, async (req, res) => {
        try {
            await Auth.is_auth(config.models, req, {
                resources: [
                    { access: AuthResourceAccess.DATA, id: parseInt(req.params.dataid) }
                ]
            });

            let data = await config.models.Data.from(parseInt(req.params.dataid));
            return res.json(data);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.get('/connection/:connectionid/data', {
        name: 'List Data',
        group: 'Data',
        params: Type.Object({
            connectionid: Type.Integer()
        }),
        description: 'List data',
        query: 'req.query.ListData.json',
        res: 'res.ListData.json'
    }, async (req, res) => {
        try {
            await Auth.is_auth(config.models, req, {
                resources: [{ access: AuthResourceAccess.CONNECTION, id: parseInt(req.params.connectionid) }]
            });

            const list = await config.models.Data.list({
                limit: Number(req.query.limit),
                page: Number(req.query.page),
                order: String(req.query.order),
                sort: String(req.query.sort),
                where: sql`
                    name ~* ${req.query.filter}
                    AND (${Param(req.params.connectionid)}::BIGINT IS NULL OR connection = ${Param(req.params.connectionid)}::BIGINT)
                `
            });

            res.json(list);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.post('/connection/:connectionid/data', {
        name: 'Create data',
        group: 'Data',
        description: 'Register a new data source',
        params: Type.Object({
            connectionid: Type.Integer()
        }),
        body: 'req.body.CreateData.json',
        res: 'res.Data.json'
    }, async (req, res) => {
        try {
            await Auth.is_auth(config.models, req, {
                resources: [{ access: AuthResourceAccess.CONNECTION, id: parseInt(req.params.connectionid) }]
            });

            const data = await config.models.Data.generate({
                ...req.body,
                connection: req.params.connectionid
            });

            try {
                const mission = await DataMission.sync(config, data);
            } catch (err) {
                return res.json({
                    mission_exists: false,
                    mission_error: err instanceof Error ? err.message : String(err),
                    ...data
                });
            }

            return res.json({
                mission_exists: true,
                ...data
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.patch('/connection/:connectionid/data/:dataid', {
        name: 'Update Layer',
        group: 'Data',
        description: 'Update a data source',
        params: Type.Object({
            connectionid: Type.Integer()
            dataid: Type.Integer()
        }),
        body: 'req.body.PatchData.json',
        res: 'res.Data.json'
    }, async (req, res) => {
        try {
            await Auth.is_auth(config.models, req, {
                resources: [
                    { access: AuthResourceAccess.DATA, id: parseInt(req.params.dataid) },
                    { access: AuthResourceAccess.CONNECTION, id: parseInt(req.params.connectionid) }
                ]
            });

            let data = await config.models.Data.commit(parseInt(req.params.dataid), {
                updated: sql`Now()`,
                ...req.body
            });

            try {
                const mission = await DataMission.sync(config, data);
            } catch (err) {
                return res.json({
                    mission_exists: false,
                    mission_error: err instanceof Error ? err.message : String(err),
                    ...data
                });
            }

            return res.json({
                mission_exists: true,
                ...data
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.get('/connection/:connectionid/data/:dataid', {
        name: 'Get Data',
        group: 'Data',
        description: 'Get a data source',
        params: Type.Object({
            connectionid: Type.Integer()
            dataid: Type.Integer()
        }),
        res: 'res.Data.json'
    }, async (req, res) => {
        try {
            await Auth.is_auth(config.models, req, {
                resources: [
                    { access: AuthResourceAccess.DATA, id: parseInt(req.params.dataid) },
                    { access: AuthResourceAccess.CONNECTION, id: parseInt(req.params.connectionid) }
                ]
            });

            let data = await config.models.Data.from(parseInt(req.params.dataid));

            try {
                const mission = await DataMission.sync(config, data);
            } catch (err) {
                return res.json({
                    mission_exists: false,
                    mission_error: err instanceof Error ? err.message : String(err),
                    ...data
                });
            }

            return res.json({
                mission_exists: true,
                ...data
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.delete('/connection/:connectionid/data/:dataid', {
        name: 'Delete Data',
        group: 'Data',
        description: 'Delete a data source',
        params: Type.Object({
            connectionid: Type.Integer()
            dataid: Type.Integer()
        }),
        res: StandardResponse
    }, async (req, res) => {
        try {
            await Auth.is_auth(config.models, req, {
                resources: [{ access: AuthResourceAccess.CONNECTION, id: parseInt(req.params.connectionid) }]
            });

            const data = await config.models.Data.from(parseInt(req.params.dataid));

            await S3.del(`data-${String(req.params.dataid)}/`, { recurse: true });

            data.mission_sync = false;
            await DataMission.sync(config, data);

            await config.models.Data.delete(parseInt(req.params.dataid));

            return res.json({
                status: 200,
                message: 'Data Deleted'
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });
}

import { Type } from '@sinclair/typebox'
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import { Data } from '../lib/schema.js';
import Config from '../lib/config.js';
import S3 from '../lib/aws/s3.js';
import { Param } from '@openaddresses/batch-generic';
import { sql, eq } from 'drizzle-orm';
import DataMission from '../lib/data-mission.js';
import { GenericListOrder } from '@openaddresses/batch-generic';
import { AuthResourceAccess } from '@tak-ps/blueprint-login';
import { StandardResponse, DataResponse, DataListResponse } from '../lib/types.js';

export default async function router(schema: Schema, config: Config) {
    await schema.get('/data', {
        private: true,
        name: 'Internal List Data',
        group: 'Data',
        description: `
            Used by the frontend UI to list data packages that the user can visualize
        `,
        query: Type.Object({
            limit: Type.Optional(Type.Integer()),
            page: Type.Optional(Type.Integer()),
            order: Type.Optional(Type.Enum(GenericListOrder)),
            sort: Type.Optional(Type.String({default: 'created', enum: Object.keys(Data)})),
            filter: Type.Optional(Type.String({default: ''}))
        }),
        res: Type.Object({
            total: Type.Integer(),
            items: Type.Array(DataListResponse)
        })
    }, async (req, res) => {
        try {
            await Auth.is_auth(config, req);

            const list = await config.models.Data.list({
                limit: req.query.limit,
                page: req.query.page,
                order: req.query.order,
                sort: req.query.sort,
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
            dataid: Type.Integer()
        }),
        res: DataResponse
    }, async (req, res) => {
        try {
            await Auth.is_auth(config, req, {
                resources: [
                    { access: AuthResourceAccess.DATA, id: req.params.dataid }
                ]
            });

            let data = await config.models.Data.from(req.params.dataid);

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

    await schema.get('/connection/:connectionid/data', {
        name: 'List Data',
        group: 'Data',
        params: Type.Object({
            connectionid: Type.Integer()
        }),
        description: 'List data',
        query: Type.Object({
            limit: Type.Optional(Type.Integer()),
            page: Type.Optional(Type.Integer()),
            order: Type.Optional(Type.Enum(GenericListOrder)),
            sort: Type.Optional(Type.String({default: 'created', enum: Object.keys(Data)})),
            filter: Type.Optional(Type.String({default: ''}))
        }),
        res: Type.Object({
            total: Type.Integer(),
            items: Type.Array(DataListResponse)
        })
    }, async (req, res) => {
        try {
            await Auth.is_auth(config, req, {
                resources: [{ access: AuthResourceAccess.CONNECTION, id: req.params.connectionid }]
            });

            const list = await config.models.Data.list({
                limit: req.query.limit,
                page: req.query.page,
                order: req.query.order,
                sort: req.query.sort,
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
        body: Type.Object({
            name: Type.String(),
            description: Type.String(),
            auto_transform: Type.Optional(Type.Boolean()),
            mission_sync: Type.Optional(Type.Boolean()),
            mission_groups: Type.Optional(Type.Array(Type.String())),
            mission_role: Type.Optional(Type.String())
        }),
        res: DataResponse
    }, async (req, res) => {
        try {
            await Auth.is_auth(config, req, {
                resources: [{ access: AuthResourceAccess.CONNECTION, id: req.params.connectionid }]
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
            connectionid: Type.Integer(),
            dataid: Type.Integer()
        }),
        body: Type.Object({
            name: Type.String(),
            description: Type.String(),
            auto_transform: Type.Optional(Type.Boolean()),
            mission_sync: Type.Optional(Type.Boolean())
        }),
        res: DataResponse
    }, async (req, res) => {
        try {
            await Auth.is_auth(config, req, {
                resources: [
                    { access: AuthResourceAccess.DATA, id: req.params.dataid },
                    { access: AuthResourceAccess.CONNECTION, id: req.params.connectionid }
                ]
            });

            let data = await config.models.Data.commit(req.params.dataid, {
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
            connectionid: Type.Integer(),
            dataid: Type.Integer()
        }),
        res: DataResponse
    }, async (req, res) => {
        try {
            await Auth.is_auth(config, req, {
                resources: [
                    { access: AuthResourceAccess.DATA, id: req.params.dataid },
                    { access: AuthResourceAccess.CONNECTION, id: req.params.connectionid }
                ]
            });

            let data = await config.models.Data.from(req.params.dataid);

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
            connectionid: Type.Integer(),
            dataid: Type.Integer()
        }),
        res: StandardResponse
    }, async (req, res) => {
        try {
            await Auth.is_auth(config, req, {
                resources: [{ access: AuthResourceAccess.CONNECTION, id: req.params.connectionid }]
            });

            const data = await config.models.Data.from(req.params.dataid);

            await S3.del(`data-${String(req.params.dataid)}/`, { recurse: true });

            data.mission_sync = false;
            await DataMission.sync(config, data);

            await config.models.Data.delete(req.params.dataid);

            return res.json({
                status: 200,
                message: 'Data Deleted'
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });
}

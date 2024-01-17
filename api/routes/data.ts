import Err from '@openaddresses/batch-error';
import { Data, DataMission } from '../lib/schema.ts';
import Auth from '../lib/auth.ts';
import { Response } from 'express';
import { AuthRequest } from '@tak-ps/blueprint-login';
import { type InferSelectModel } from 'drizzle-orm';
import Config from '../lib/config.ts';
import S3 from '../lib/aws/s3.ts';
import Modeler, { Param } from '@openaddresses/batch-generic';
import { sql, eq } from 'drizzle-orm';

export async function augment(Model, data: InferSelectModel<typeof Data>): Promise<object> {
    let mission = false;
    try {
        mission = await Model.from(eq(DataMission.data, data.id))
    } catch (err) {
        mission = false;
    }

    return {
        ...data,
        mission
    }
}

export default async function router(schema: any, config: Config) {
    const DataModel = new Modeler(config.pg, Data);
    const DataMissionModel = new Modeler(config.pg, DataMission);

    await schema.get('/data', {
        name: 'List Data',
        group: 'Data',
        auth: 'user',
        description: 'List data',
        query: 'req.query.ListData.json',
        res: 'res.ListData.json'
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(req);

            const list = await DataModel.list({
                limit: Number(req.query.limit),
                page: Number(req.query.page),
                order: String(req.query.order),
                sort: String(req.query.sort),
                where: sql`
                    name ~* ${req.query.filter}
                    AND (${Param(req.query.connection)}::BIGINT IS NULL OR connection = ${Param(req.query.connection)}::BIGINT)
                `
            });

            res.json(list);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.post('/data', {
        name: 'Create data',
        group: 'Data',
        auth: 'admin',
        description: 'Register a new data source',
        body: 'req.body.CreateData.json',
        res: 'res.Data.json'
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(req);

            const data = await DataModel.generate(req.body);

            return res.json(data);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.patch('/data/:dataid', {
        name: 'Update Layer',
        group: 'Data',
        auth: 'admin',
        description: 'Update a data source',
        ':dataid': 'integer',
        body: 'req.body.PatchData.json',
        res: 'res.Data.json'
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(req);

            let data = await DataModel.commit(parseInt(req.params.dataid), {
                updated: sql`Now()`,
                ...req.body
            });

            return res.json(await augment(DataMissionModel, data));
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.get('/data/:dataid', {
        name: 'Get Data',
        group: 'Data',
        auth: 'user',
        description: 'Get a data source',
        ':dataid': 'integer',
        res: 'res.Data.json'
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(req);

            let data = await DataModel.from(parseInt(req.params.dataid));
            return res.json(await augment(DataMissionModel, data));
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.post('/data/:dataid/mission', {
        name: 'Attach Mission',
        group: 'Data',
        auth: 'admin',
        ':dataid': 'integer',
        description: 'Attach a TAK Server Mission to a Data Layer',
        body: 'req.body.CreateDataMission.json',
        res: 'res.Data.json'
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(req);

            let data = await DataModel.from(parseInt(req.params.dataid));

            const mission = await DataMissionModel.generate({
                ...req.body,
                data: req.params.dataid
            });

            return res.json({
                ...data,
                mission
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.delete('/data/:dataid', {
        name: 'Delete Data',
        group: 'Data',
        auth: 'user',
        description: 'Delete a data source',
        ':dataid': 'integer',
        res: 'res.Standard.json'
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(req);

            await S3.del(`data-${String(req.params.dataid)}/`, { recurse: true });

            await DataModel.delete(parseInt(req.params.dataid));

            return res.json({
                status: 200,
                message: 'Data Deleted'
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });
}

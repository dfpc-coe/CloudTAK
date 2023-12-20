import Err from '@openaddresses/batch-error';
import Data from '../lib/types/data.js';
import DataMission from '../lib/types/data-mission.js';
import { sql } from 'slonik';
import Auth from '../lib/auth.js';
import { Response } from 'express';
import { AuthRequest } from '@tak-ps/blueprint-login';
import Config from '../lib/config.js';
import S3 from '../lib/aws/s3.js';

export default async function router(schema: any, config: Config) {
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

            const list = await Data.list(config.pool, req.query);

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
            let data = await Data.generate(config.pool, req.body);
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

            let data = await Data.commit(config.pool, parseInt(req.params.dataid), {
                updated: sql`Now()`,
                ...req.body
            });

            data = data.serialize();

            try {
                data.mission = await DataMission.from(config.pool, req.params.dataid, {
                    column: 'data'
                });
            } catch (err) {
                data.mission = false;
            }

            return res.json(data);
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

            let data = await Data.from(config.pool, req.params.dataid);

            data = data.serialize();

            try {
                data.mission = await DataMission.from(config.pool, req.params.dataid, {
                    column: 'data'
                });
            } catch (err) {
                data.mission = false;
            }

            return res.json(data);
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

            let data = await Data.from(config.pool, req.params.dataid);
            data = data.serialize();

            data.mission = await DataMission.generate(config.pool, {
                ...req.body,
                data: req.params.dataid
            });

            return res.json(data);
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

            const data = await Data.from(config.pool, req.params.dataid);

            await S3.del(`data-${data.id}/`, { recurse: true });

            await data.delete();

            return res.json({
                status: 200,
                message: 'Data Deleted'
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });
}

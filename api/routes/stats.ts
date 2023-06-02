import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
// @ts-ignore
import { Schema } from '@openaddresses/batch-generic';
import { stringify } from '../node_modules/csv-stringify/lib/sync.js';
import Config from '../lib/config.js';
import moment from 'moment';
// @ts-ignore
import Field from '../lib/types/field.js';
// @ts-ignore
import Total from '../lib/types/total.js';
import { Response } from 'express';
import { AuthRequest } from '@tak-ps/blueprint-login';

export default async function router(schema: any, config: Config) {
    await schema.get('/aggregate/:aggregate', {
        name: 'Get Aggregates',
        group: 'Aggregate',
        auth: 'public',
        description: 'Retrieve aggregates for a given time range',
        ':aggregate': 'string',
        res: 'res.Aggregate.json'
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(req);

            const agg = await Field.aggregate(config.pool, req.params.aggregate);

            return res.json(agg);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.get('/field', {
        name: 'Get Fields',
        group: 'Field',
        auth: 'public',
        description: 'Retrieve all fields for a given time range',
        res: 'res.ListField.json'
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(req);

            const list = await Field.list(config.pool);
            return res.json(list);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.get('/field/export', {
        name: 'Export Fields',
        group: 'Field',
        auth: 'public',
        description: 'Export all fields for a given time range to a CSV',
        query: 'req.query.ExportField.json'
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(req);

            const cols = Object.keys(Schema.from(config.pool, Field).properties);

            res.header('Content-Disposition', `attachment; filename="tak-fields.${req.query.format}"`);
            if (req.query.format === 'csv') {
                res.header('Content-Type', 'text/csv');
                res.write(stringify([cols]));
            } else {
                res.header('Content-Type', 'application/ld+json');
            }

            (await Field.stream(config.pool, {
                order: req.query.order,
                sort: req.query.sort
            })).on('data', async (field: Field) => {
                field = field.serialize();

                if (req.query.format === 'jsonld') {
                    res.write(JSON.stringify(field) + '\n');
                } else {
                    const arr = [];
                    for (const key of cols) arr.push(field[key]);
                    res.write(stringify([arr]));
                }
            }).on('end', () => {
                res.end();
            });

        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.post('/record', {
        name: 'Record Stats',
        group: 'Record',
        auth: 'user',
        description: 'The daily ETL process will push updates to this endpoint',
        body: 'req.body.Record.json',
        res: 'res.Standard.json'
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(req);

/*
            if (req.auth.access !== 'machine') {
                throw new Err(401, null, 'Unauthorized');
            }
*/

            const dt = req.body.date || moment().format('YYYY-MM-DD');
            delete req.body.date;

            await Total.generate(config.pool, {
                dt,
                count: req.body.count
            });
            delete req.body.count;

            for (const field in req.body) {
                await Field.generate(config.pool, {
                    dt,
                    dim: field,
                    stats: req.body[field]
                });
            }

            return res.json({
                status: 200,
                message: 'Recorded Stats'
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.get('/total', {
        name: 'Get Totals',
        group: 'Total',
        auth: 'public',
        description: 'Retrieve total users across time',
        res: 'res.ListTotal.json'
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(req);
            const list = await Total.list(config.pool, req.query);
            return res.json(list);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.get('/total/export', {
        name: 'Export Totals',
        group: 'Total',
        auth: 'public',
        description: 'Export total users across time to a CSV',
        query: 'req.query.ExportTotal.json'
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(req);
            const cols = Object.keys(Schema.from(config.pool, Total).properties);

            res.header('Content-Disposition', `attachment; filename="tak-total-users.${req.query.format}"`);
            if (req.query.format === 'csv') {
                res.header('Content-Type', 'text/csv');
                res.write(stringify([cols]));
            } else {
                res.header('Content-Type', 'application/ld+json');
            }

            (await Total.stream(config.pool, {
                order: req.query.order,
                sort: req.query.sort
            })).on('data', async (total: Total) => {
                total = total.serialize();

                if (req.query.format === 'jsonld') {
                    res.write(JSON.stringify(total) + '\n');
                } else {
                    const arr = [];
                    for (const key of cols) arr.push(total[key]);
                    res.write(stringify([arr]));
                }
            }).on('end', () => {
                res.end();
            });

        } catch (err) {
            return Err.respond(err, res);
        }
    });
}

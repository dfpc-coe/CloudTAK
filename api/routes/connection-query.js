import Err from '@openaddresses/batch-error';
import Connection from '../lib/types/connection.js';
import ConnectionQuery from '../lib/types/connection.js';
import Auth from '../lib/auth.js';
import { sql } from 'slonik';

export default async function router(schema, config) {
    await schema.get('/connection/:connectionid/query', {
        name: 'List Queries',
        group: 'ConnectionQuery',
        auth: 'user',
        description: 'List Connection Queries',
        ':connectionid': 'integer',
        query: 'req.query.ListConnectionQuery.json',
        res: 'res.ListConnectionQuery.json'
    }, async (req, res) => {
        try {
            await Auth.is_auth(req);

            const list = await Connection.list(config.pool, req.query);

            list.connections.map((conn) => {
                conn.status = config.conns.status(conn.id);
            });

            list.status = { dead: 0, live: 0, unknown: 0 };
            for (const conn of config.conns.values()) {
                if (!conn.tak) list.status.unknown++;
                else list.status[conn.tak.open]++;
            }

            return res.json(list);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.post('/connection/:connectionid/query', {
        name: 'Create Query',
        group: 'ConnectionQuery',
        auth: 'admin',
        description: 'Register a new connection query',
        ':connectionid': 'integer',
        body: 'req.body.CreateConnectionQuery.json',
        res: 'res.ConnectionQuery.json'
    }, async (req, res) => {
        try {
            await Auth.is_auth(req);

            if (!config.server) throw new Err(400, null, 'TAK Server must be configured before a connection can be made');
            const conn = await Connection.generate(config.pool, req.body);

            await config.conns.add(conn);

            conn.status = config.conns.status(conn.id);
            return res.json(conn);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.patch('/connection/:connectionid/query/:queryid', {
        name: 'Update Query',
        group: 'ConnectionQuery',
        auth: 'admin',
        description: 'Update a connection query',
        ':connectionid': 'integer',
        ':queryid': 'integer',
        body: 'req.body.PatchConnectionQuery.json',
        res: 'res.ConnectionQuery.json'
    }, async (req, res) => {
        try {
            await Auth.is_auth(req);
            const conn = await Connection.commit(config.pool, req.params.connectionid, {
                updated: sql`Now()`,
                ...req.body
            });

            conn.status = config.conns.status(conn.id);
            return res.json(conn);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.get('/connection/:connectionid/query/:queryid', {
        name: 'Get Query',
        group: 'ConnectionQuery',
        auth: 'user',
        description: 'Get a connection query',
        ':connectionid': 'integer',
        ':queryid': 'integer',
        res: 'res.ConnectionQuery.json'
    }, async (req, res) => {
        try {
            await Auth.is_auth(req);

            const conn = (await Connection.from(config.pool, req.params.connectionid)).serialize();
            conn.status = config.conns.status(conn.id);

            return res.json(conn);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.delete('/connection/:connectionid/query/:queryid', {
        name: 'Delete Query',
        group: 'Connection',
        auth: 'user',
        description: 'Delete a connection query',
        ':connectionid': 'integer',
        ':queryid': 'integer',
        res: 'res.Standard.json'
    }, async (req, res) => {
        try {
            await Auth.is_auth(req);

            await Connection.delete(config.pool, req.params.connectionid);

            config.conns.delete(req.params.connectionid);

            return res.json({
                status: 200,
                message: 'Connection Deleted'
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });
}

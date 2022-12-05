import Err from '@openaddresses/batch-error';
import Connection from '../lib/types/connection.js';
import { XML as COT } from '@tak-ps/node-cot';

export default async function router(schema, config) {
    await schema.get('/connection', {
        name: 'List Connections',
        group: 'Connection',
        auth: 'user',
        description: 'List Connections',
        query: 'req.query.ListConnections.json',
        res: 'res.ListConnections.json'
    }, async (req, res) => {
        try {
            const list = await Connection.list(config.pool, req.query);

            list.connections.map((conn) => {
                conn.status = config.conns.get(conn.id).tak.open ? 'live' : 'dead';
            });

            return res.json(list);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.post('/connection', {
        name: 'Create Connection',
        group: 'Connection',
        auth: 'admin',
        description: 'Register a new connection',
        body: 'req.body.CreateConnection.json',
        res: 'res.Connection.json'
    }, async (req, res) => {
        try {
            const conn = await Connection.generate(config.pool, req.body);

            await config.conns.add(conn);

            conn.status = config.conns.get(conn.id).tak.open ? 'live' : 'dead';
            return res.json(conn);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.patch('/connection/:connectionid', {
        name: 'Update Connection',
        group: 'Connection',
        auth: 'admin',
        description: 'Update a connection',
        ':connectionid': 'string',
        body: 'req.body.PatchConnection.json',
        res: 'res.Connection.json'
    }, async (req, res) => {
        try {
            const conn = await Connection.commit(config.pool, req.params.connectionid, req.body);
            conn.status = config.conns.get(conn.id).tak.open ? 'live' : 'dead';
            return res.json(conn);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.get('/connection/:connectionid', {
        name: 'Get Connection',
        group: 'Connection',
        auth: 'user',
        description: 'Get a connection',
        ':connectionid': 'string',
        res: 'res.Connection.json'
    }, async (req, res) => {
        try {
            const conn = (await Connection.from(config.pool, req.params.connectionid)).serialize();
            conn.status = config.conns.get(conn.id).tak.open ? 'live' : 'dead';
            return res.json(conn);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.delete('/connection/:connectionid', {
        name: 'Delete Connection',
        group: 'Connection',
        auth: 'user',
        description: 'Delete a connection',
        ':connectionid': 'string',
        res: 'res.Standard.json'
    }, async (req, res) => {
        try {
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

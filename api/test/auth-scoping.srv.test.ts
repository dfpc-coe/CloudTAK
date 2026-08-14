import test from 'node:test';
import assert from 'node:assert';
import ws from 'ws';
import Flight from './flight.js';

const flight = new Flight();

flight.init({ takserver: true });
flight.takeoff();
flight.user();
flight.user({ username: 'user', admin: false });

flight.connection();

test('Create Layer', async () => {
    try {
        const layer = await flight.config!.models.Layer.generate({
            name: 'Test Layer',
            connection: 1,
            task: 'etl-test:v1.0.0',
        });

        await flight.config!.models.LayerIncoming.generate({
            layer: layer.id,
            environment: { UPSTREAM_API_KEY: 'super-secret' },
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/layer/1 - Non-Admin user cannot read a Layer of a Connection they do not administer', async () => {
    try {
        const res = await flight.fetch('/api/layer/1', {
            method: 'GET',
            auth: {
                bearer: flight.token.user,
            },
        }, false);

        assert.deepEqual(res.body, {
            status: 401,
            message: 'Only a System Admin can access this connection',
            messages: [],
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/layer/1 - System Admin can read the Layer', async () => {
    try {
        const res = await flight.fetch('/api/layer/1', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.equal(res.body.id, 1);
        assert.equal(res.body.connection, 1);
        assert.deepEqual(res.body.incoming.environment, { UPSTREAM_API_KEY: 'super-secret' });
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/marti/group - Non-Admin user cannot borrow a Connection\'s certificate', async () => {
    try {
        const res = await flight.fetch('/api/marti/group?connection=1&useCache=true', {
            method: 'GET',
            auth: {
                bearer: flight.token.user,
            },
        }, false);

        assert.deepEqual(res.body, {
            status: 401,
            message: 'Only a System Admin can access this connection',
            messages: [],
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('PUT: api/marti/group - Non-Admin user cannot rewrite a Connection\'s channels', async () => {
    try {
        const res = await flight.fetch('/api/marti/group?connection=1', {
            method: 'PUT',
            auth: {
                bearer: flight.token.user,
            },
            // flight.fetch only serializes plain object bodies, not bare arrays
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify([{
                name: 'Test Channel',
                direction: 'OUT',
                created: '2025-01-01T00:00:00.000Z',
                type: 'SYSTEM',
                bitpos: 1,
                active: false,
            }]),
        }, false);

        assert.deepEqual(res.body, {
            status: 401,
            message: 'Only a System Admin can access this connection',
            messages: [],
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/marti/clients - Non-Admin user cannot enumerate clients via a Connection', async () => {
    try {
        const res = await flight.fetch('/api/marti/clients?connection=1', {
            method: 'GET',
            auth: {
                bearer: flight.token.user,
            },
        }, false);

        assert.deepEqual(res.body, {
            status: 401,
            message: 'Only a System Admin can access this connection',
            messages: [],
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/marti/group - System Admin can use a Connection\'s certificate', async () => {
    try {
        const res = await flight.fetch('/api/marti/group?connection=1&useCache=true', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.ok(Array.isArray(res.body.data));
    } catch (err) {
        assert.ifError(err);
    }
});

function subscribe(connection: number, token: string): Promise<{ type: string; message?: string }> {
    const url = new URL(flight.base.replace(/^http/, 'ws'));
    url.searchParams.append('format', 'geojson');
    url.searchParams.append('connection', String(connection));
    url.searchParams.append('token', token);

    return new Promise((resolve, reject) => {
        const conn = new ws(url);

        conn.on('unexpected-response', () => reject(new Error('Upgrade rejected')));
        conn.on('error', err => reject(err));
        conn.on('message', (data) => {
            const res = JSON.parse(String(data));

            if (res.type === 'status') return;

            conn.close();

            resolve({
                type: res.type,
                message: res.properties ? res.properties.message : undefined,
            });
        });
    });
}

test('WS: Non-Admin user cannot subscribe to a Connection CoT stream', async () => {
    try {
        assert.deepEqual(await subscribe(1, flight.token.user), {
            type: 'Error',
            message: 'Only a System Admin can access this connection',
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('WS: System Admin can subscribe to a Connection CoT stream', async () => {
    try {
        assert.deepEqual(await subscribe(1, flight.token.admin), {
            type: 'connected',
            message: undefined,
        });
    } catch (err) {
        assert.ifError(err);
    }
});

flight.landing();

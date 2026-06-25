import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';

const flight = new Flight();

flight.init({ takserver: true });
flight.takeoff();
flight.user();

test('Admin connection is live by default on startup', async () => {
    try {
        const res = await flight.fetch('/api/server', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.equal(res.body.connection, true, 'connection flag should be true by default');
        // In the mock environment tak.open is false until a t-x-c-t-r ping COT arrives,
        // so status will be 'dead' rather than 'live' — but it must not be 'unknown'
        // (which would mean the connection is absent from the pool entirely).
        assert.notEqual(res.body.connection_status, 'unknown', 'admin connection should be present in pool on startup');
        assert.ok(flight.config!.conns.has(0), 'admin connection should be present in pool');
    } catch (err) {
        assert.ifError(err);
    }
});

test('PATCH: api/server - connection: false stops the admin connection', async () => {
    try {
        const res = await flight.fetch('/api/server', {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                name: 'Default Server',
                url: flight.config!.server.url,
                api: flight.config!.server.api,
                webtak: flight.config!.server.webtak,
                connection: false,
            },
        }, true);

        assert.equal(res.body.connection, false, 'connection flag should be false');
        assert.equal(res.body.connection_status, 'unknown', 'connection_status should be unknown when disabled');
        assert.ok(!flight.config!.conns.has(0), 'admin connection should be removed from pool');
    } catch (err) {
        assert.ifError(err);
    }
});

test('PATCH: api/server - connection: true restarts the admin connection', async () => {
    try {
        const res = await flight.fetch('/api/server', {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                name: 'Default Server',
                url: flight.config!.server.url,
                api: flight.config!.server.api,
                webtak: flight.config!.server.webtak,
                connection: true,
            },
        }, true);

        assert.equal(res.body.connection, true, 'connection flag should be true');
        // Not 'unknown' means the connection is back in the pool.
        assert.notEqual(res.body.connection_status, 'unknown', 'admin connection should be present in pool after re-enabling');
        assert.ok(flight.config!.conns.has(0), 'admin connection should be back in pool');
    } catch (err) {
        assert.ifError(err);
    }
});

// Remove the admin connection from the pool so the retry loop doesn't keep
// the event loop alive after the mock TAK server is shut down during landing.
test('Cleanup: remove admin connection from pool', async () => {
    if (flight.config!.conns.has(0)) {
        flight.config!.conns.delete(0);
    }
});

flight.landing();

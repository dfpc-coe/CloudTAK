import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';

const flight = new Flight();

flight.init();
flight.takeoff();
flight.user();
flight.user({ admin: false });

test('Reset Server to Unconfigured', async () => {
    try {
        flight.config!.server = await flight.config!.models.Server.commit(1, {
            name: 'Default Server',
            url: '',
            api: '',
            webtak: '',
            auth: {}
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/server - Unconfigured - Admin', async () => {
    try {
        const res = await flight.fetch('/api/server', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        delete res.body.version;
        delete res.body.created;
        delete res.body.updated;

        assert.deepEqual(res.body, {
            id: 1,
            status: 'unconfigured',
            name: 'Default Server',
            url: '',
            api: '',
            webtak: '',
            auth: false
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/server - Unconfigured - User', async () => {
    try {
        const res = await flight.fetch('/api/server', {
            method: 'GET',
            auth: {
                bearer: flight.token.user
            }
        }, true);

        delete res.body.version;
        delete res.body.created;
        delete res.body.updated;

        assert.deepEqual(res.body, {
            id: 1,
            status: 'unconfigured',
            name: 'Default Server',
            url: '',
            api: '',
            webtak: '',
            auth: false
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/server - Unconfigured - No Auth', async () => {
    try {
        const res = await flight.fetch('/api/server', {
            method: 'GET',
            auth: {
                bearer: flight.token.user
            }
        }, true);

        delete res.body.version;
        delete res.body.created;
        delete res.body.updated;

        assert.deepEqual(res.body, {
            id: 1,
            status: 'unconfigured',
            name: 'Default Server',
            url: '',
            api: '',
            webtak: '',
            auth: false
        });
    } catch (err) {
        assert.ifError(err);
    }
});

flight.landing();

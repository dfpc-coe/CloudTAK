import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import Flight from './flight.js';

const flight = new Flight();

flight.init({ takserver: true });
flight.takeoff();
flight.user();
flight.user({ admin: false });

test('GET: api/server - Configured - Admin', async () => {
    try {
        const res = await flight.fetch('/api/server', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        assert.equal(res.body.status, 'configured');
        assert.equal(res.body.auth, true);
        assert.ok(res.body.certificate);
        assert.ok(res.body.certificate.subject);
        assert.ok(res.body.certificate.validFrom);
        assert.ok(res.body.certificate.validTo);
        assert.ok(res.body.url);
        assert.ok(res.body.api);
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/server - Configured - Non-admin User', async () => {
    try {
        const res = await flight.fetch('/api/server', {
            method: 'GET',
            auth: {
                bearer: flight.token.user
            }
        }, true);

        assert.equal(res.body.status, 'configured');
        assert.equal(res.body.auth, true);
        assert.equal(res.body.certificate, undefined);
        assert.ok(res.body.url);
        assert.ok(res.body.api);
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/server - Configured - No Auth', async () => {
    try {
        const res = await flight.fetch('/api/server', {
            method: 'GET',
        }, false);

        assert.equal(res.status, 401);
    } catch (err) {
        assert.ifError(err);
    }
});

test('PATCH: api/server - Configured - Non-admin User', async () => {
    try {
        const res = await flight.fetch('/api/server', {
            method: 'PATCH',
            auth: {
                bearer: flight.token.user
            },
            body: {
                name: 'Updated Server',
                url: 'ssl://localhost:8089',
                api: 'https://localhost:8443',
                webtak: 'http://localhost:8444',
                auth: {
                    cert: String(fs.readFileSync(flight.tak.keys.cert)),
                    key: String(fs.readFileSync(flight.tak.keys.key))
                }
            }
        }, false);

        assert.equal(res.status, 401);
    } catch (err) {
        assert.ifError(err);
    }
});

test('PATCH: api/server - Configured - Admin', async () => {
    try {
        const res = await flight.fetch('/api/server', {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                name: 'Updated Server',
                url: 'ssl://localhost:8089',
                api: 'https://localhost:8443',
                webtak: 'http://localhost:8444',
                auth: {
                    cert: String(fs.readFileSync(flight.tak.keys.cert)),
                    key: String(fs.readFileSync(flight.tak.keys.key))
                }
            }
        }, true);

        assert.equal(res.body.status, 'configured');
        assert.equal(res.body.name, 'Updated Server');
        assert.equal(res.body.auth, true);
        assert.ok(res.body.certificate);
    } catch (err) {
        assert.ifError(err);
    }
});

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

test('PATCH: api/server - Unconfigured without username/password', async () => {
    try {
        const res = await flight.fetch('/api/server', {
            method: 'PATCH',
            body: {
                name: 'Test Server',
                url: 'ssl://localhost:8089',
                api: 'https://localhost:8443',
                webtak: 'http://localhost:8444',
                auth: {
                    cert: String(fs.readFileSync(flight.tak.keys.cert)),
                    key: String(fs.readFileSync(flight.tak.keys.key))
                }
            }
        }, false);

        assert.equal(res.status, 400);
        assert.equal(res.body.message, 'Initial configuration must include valid TAK Username & Password to set System Administrator');
    } catch (err) {
        assert.ifError(err);
    }
});

flight.landing();

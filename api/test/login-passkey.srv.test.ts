import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';

const flight = new Flight();

flight.init({ takserver: true });
flight.takeoff();
flight.user();
flight.server('admin@example.com', 'password123');

test('GET: api/login/passkey - empty before registration', async () => {
    try {
        const res = await flight.fetch('/api/login/passkey', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, false);

        assert.deepEqual(res.body, {
            total: 0,
            items: []
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/login/passkey/register/options - get registration options', async () => {
    try {
        const res = await flight.fetch('/api/login/passkey/register/options', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin
            }
        }, false);

        assert.ok(res.body.challenge);
        assert.ok(res.body.rp);
        assert.equal(res.body.rp.name, 'CloudTAK');
        assert.ok(res.body.user);
        assert.equal(res.body.user.name, 'admin@example.com');
        assert.ok(Array.isArray(res.body.pubKeyCredParams));
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/login/passkey/authenticate/options - get auth options (no username)', async () => {
    try {
        const res = await flight.fetch('/api/login/passkey/authenticate/options', {
            method: 'POST',
            body: {}
        }, false);

        assert.ok(res.body.challenge);
        assert.equal(res.body.rpId, 'localhost');
    } catch (err) {
        assert.ifError(err);
    }
});



test('POST: api/login/passkey/register - rejects invalid credential', async () => {
    try {
        // First get registration options to generate a challenge
        await flight.fetch('/api/login/passkey/register/options', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin
            }
        }, false);

        const res = await flight.fetch('/api/login/passkey/register', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                name: 'Test Key',
                credential: {
                    id: 'fake-credential-id',
                    rawId: 'fake-credential-id',
                    type: 'public-key',
                    response: {
                        attestationObject: 'AAAA',
                        clientDataJSON: 'AAAA',
                    },
                    clientExtensionResults: {}
                }
            }
        }, false);

        assert.ok(!res.ok);
        assert.equal(res.status, 400);
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/login/passkey/authenticate - rejects unknown credential', async () => {
    try {
        // Get auth options first
        await flight.fetch('/api/login/passkey/authenticate/options', {
            method: 'POST',
            body: {}
        }, false);

        const res = await flight.fetch('/api/login/passkey/authenticate', {
            method: 'POST',
            body: {
                credential: {
                    id: 'nonexistent-credential',
                    rawId: 'nonexistent-credential',
                    type: 'public-key',
                    response: {
                        authenticatorData: 'AAAA',
                        clientDataJSON: 'AAAA',
                        signature: 'AAAA',
                    },
                    clientExtensionResults: {}
                }
            }
        }, false);

        assert.ok(!res.ok);
        assert.equal(res.status, 401);
    } catch (err) {
        assert.ifError(err);
    }
});

flight.landing();

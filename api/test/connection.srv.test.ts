import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';
import fs from 'fs';
import CP from 'node:child_process';
import Sinon from 'sinon';
import S3 from '../lib/aws/s3.js';

const flight = new Flight();

flight.init({ takserver: true });
flight.takeoff();
flight.user();
flight.user({ username: 'user', admin: false });

test('GET: api/connection - No Auth', async () => {
    try {
        const res = await flight.fetch('/api/connection', {
            method: 'GET',
        }, false);

        assert.equal(res.status, 401);
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/connection - Non-admin without agency_admin', async () => {
    try {
        const res = await flight.fetch('/api/connection', {
            method: 'GET',
            auth: {
                bearer: flight.token.user
            }
        }, false);

        assert.equal(res.status, 400);
        assert.equal(res.body.message, 'Insufficient Access');
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/connection - Admin (empty)', async () => {
    try {
        const res = await flight.fetch('/api/connection', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        assert.deepEqual(res.body, {
            total: 0,
            items: [],
            status: {
                dead: 0,
                live: 0,
                unknown: 0
            }
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/connection/1 - Not Found', async () => {
    try {
        const res = await flight.fetch('/api/connection/1', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, false);

        assert.deepEqual(res.body, {
            status: 404,
            message: 'Item Not Found',
            messages: []
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/connection - Invalid X509 Certificate', async () => {
    try {
        const res = await flight.fetch('/api/connection', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                name: 'Bad Cert Connection',
                description: 'test',
                auth: {
                    cert: 'not a valid certificate',
                    key: String(fs.readFileSync('/tmp/cloudtak-test-admin.key'))
                }
            }
        }, false);

        assert.equal(res.status, 400);
        assert.equal(res.body.message, 'Invalid X509 Certificate Provided');
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/connection - Non-admin without agency', async () => {
    try {
        const res = await flight.fetch('/api/connection', {
            method: 'POST',
            auth: {
                bearer: flight.token.user
            },
            body: {
                name: 'No Agency Connection',
                description: 'test',
                auth: {
                    cert: String(fs.readFileSync('/tmp/cloudtak-test-user.cert')),
                    key: String(fs.readFileSync('/tmp/cloudtak-test-user.key'))
                }
            }
        }, false);

        assert.equal(res.status, 400);
        assert.equal(res.body.message, 'Only System Admins can create a server without an Agency Configured');
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/connection - Non-admin with wrong agency', async () => {
    try {
        const res = await flight.fetch('/api/connection', {
            method: 'POST',
            auth: {
                bearer: flight.token.user
            },
            body: {
                name: 'Wrong Agency Connection',
                description: 'test',
                agency: 999,
                auth: {
                    cert: String(fs.readFileSync('/tmp/cloudtak-test-user.cert')),
                    key: String(fs.readFileSync('/tmp/cloudtak-test-user.key'))
                }
            }
        }, false);

        assert.equal(res.status, 400);
        assert.equal(res.body.message, 'Cannot create a connection for an Agency you are not an admin of');
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/connection - Non-admin agency admin creates connection for their agency', async () => {
    try {
        await flight.config!.models.Profile.commit('user@example.com', {
            agency_admin: [1]
        });

        const res = await flight.fetch('/api/connection', {
            method: 'POST',
            auth: {
                bearer: flight.token.user
            },
            body: {
                name: 'Agency Connection',
                description: 'Created by agency admin',
                agency: 1,
                auth: {
                    cert: String(fs.readFileSync('/tmp/cloudtak-test-user.cert')),
                    key: String(fs.readFileSync('/tmp/cloudtak-test-user.key'))
                }
            }
        }, true);

        assert.equal(res.body.name, 'Agency Connection');
        assert.equal(res.body.agency, 1);
        assert.equal(res.body.enabled, true);

        await new Promise((resolve) => setTimeout(resolve, 1000));

        const s3Stub = Sinon.stub(S3, 'del').resolves();
        try {
            await flight.fetch(`/api/connection/${res.body.id}`, {
                method: 'DELETE',
                auth: { bearer: flight.token.admin }
            }, true);
        } finally {
            s3Stub.restore();
        }

        await flight.config!.models.Profile.commit('user@example.com', {
            agency_admin: []
        });
    } catch (err) {
        assert.ifError(err);
    }
});

let readonlyConnId: number;

test('POST: api/connection - Readonly forces enabled to false', async () => {
    try {
        const caPem = String(fs.readFileSync(flight.tak.keys.cert));
        const caBase64 = caPem
            .replace(/-----BEGIN CERTIFICATE-----/g, '')
            .replace(/-----END CERTIFICATE-----/g, '')
            .replace(/\n/g, '');

        const res = await flight.fetch('/api/connection', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                name: 'Readonly Connection',
                description: 'Readonly test',
                readonly: true,
                enabled: true,
                auth: {
                    cert: String(fs.readFileSync('/tmp/cloudtak-test-admin.cert')),
                    key: String(fs.readFileSync('/tmp/cloudtak-test-admin.key')),
                    ca: [caBase64]
                }
            }
        }, true);

        assert.equal(res.body.name, 'Readonly Connection');
        assert.equal(res.body.readonly, true);
        assert.equal(res.body.enabled, false);

        readonlyConnId = res.body.id;
    } catch (err) {
        assert.ifError(err);
    }
});

let enabledConnId: number;

test('Creating Enabled Connection', async () => {
    try {
        CP.execSync(`
            openssl req \
                -newkey rsa:4096 \
                -keyout /tmp/cloudtak-test-alice.key \
                -out /tmp/cloudtak-test-alice.csr \
                -nodes \
                -subj "/CN=Alice" \
                2> /dev/null
        `);

        CP.execSync(`
           openssl x509 \
                -req \
                -in /tmp/cloudtak-test-alice.csr \
                -CA ${flight.tak.keys.cert} \
                -CAkey ${flight.tak.keys.key} \
                -out /tmp/cloudtak-test-alice.cert \
                -set_serial 01 \
                -days 365 \
                2> /dev/null
        `);

        const conn = await flight.fetch('/api/connection', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                name: 'Test Connection',
                description: 'Connection created by Flight Test Runner',
                auth: {
                    key: String(fs.readFileSync('/tmp/cloudtak-test-alice.key')),
                    cert: String(fs.readFileSync('/tmp/cloudtak-test-alice.cert'))
                }
            }
        }, true);

        assert.equal(conn.body.name, 'Test Connection');
        assert.equal(conn.body.enabled, true);
        assert.equal(conn.body.certificate.subject, 'CN=Alice');

        enabledConnId = conn.body.id;

        await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/connection - Admin with connections', async () => {
    try {
        const res = await flight.fetch('/api/connection', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        assert.ok(res.body.total >= 2, 'Should have at least 2 connections');
        assert.ok(res.body.items.length >= 2, 'Should list at least 2 items');

        for (const conn of res.body.items) {
            assert.ok(conn.id, 'has id');
            assert.ok(conn.name, 'has name');
            assert.ok(conn.certificate, 'has certificate');
            assert.ok(conn.certificate.subject, 'has certificate subject');
            assert.ok(typeof conn.status === 'string', 'has status');
        }
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/connection - Admin with filter', async () => {
    try {
        const res = await flight.fetch('/api/connection?filter=Readonly', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        assert.equal(res.body.total, 1);
        assert.equal(res.body.items[0].name, 'Readonly Connection');
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/connection - Agency admin sees filtered connections', async () => {
    try {
        await flight.config!.models.Profile.commit('user@example.com', {
            agency_admin: [1]
        });

        const res = await flight.fetch('/api/connection', {
            method: 'GET',
            auth: {
                bearer: flight.token.user
            }
        }, true);

        assert.equal(res.body.total, 0);

        await flight.config!.models.Profile.commit('user@example.com', {
            agency_admin: []
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/connection/:connectionid - existing', async () => {
    try {
        const res = await flight.fetch(`/api/connection/${enabledConnId}`, {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        assert.equal(res.body.id, enabledConnId);
        assert.equal(res.body.name, 'Test Connection');
        assert.ok(res.body.certificate, 'has certificate');
        assert.ok(res.body.certificate.validFrom, 'has validFrom');
        assert.ok(res.body.certificate.validTo, 'has validTo');
        assert.ok(res.body.certificate.subject, 'has subject');
        assert.ok(typeof res.body.status === 'string', 'has status');
    } catch (err) {
        assert.ifError(err);
    }
});

test('PATCH: api/connection/:connectionid - Update name and description', async () => {
    try {
        const res = await flight.fetch(`/api/connection/${enabledConnId}`, {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                name: 'Updated Connection',
                description: 'Updated description'
            }
        }, true);

        assert.equal(res.body.name, 'Updated Connection');
        assert.equal(res.body.description, 'Updated description');
        assert.ok(res.body.certificate, 'has certificate');
    } catch (err) {
        assert.ifError(err);
    }
});

test('PATCH: api/connection/:connectionid - Restore original name', async () => {
    try {
        const res = await flight.fetch(`/api/connection/${enabledConnId}`, {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                name: 'Test Connection',
                description: 'Connection created by Flight Test Runner'
            }
        }, true);

        assert.equal(res.body.name, 'Test Connection');
    } catch (err) {
        assert.ifError(err);
    }
});

test('PATCH: api/connection/:connectionid - Invalid X509 Certificate', async () => {
    try {
        const res = await flight.fetch(`/api/connection/${enabledConnId}`, {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                auth: {
                    cert: 'not a valid certificate',
                    key: String(fs.readFileSync('/tmp/cloudtak-test-admin.key'))
                }
            }
        }, false);

        assert.equal(res.status, 400);
        assert.equal(res.body.message, 'Invalid X509 Certificate Provided');
    } catch (err) {
        assert.ifError(err);
    }
});

test('PATCH: api/connection/:connectionid - Readonly prevents enabling', async () => {
    try {
        const res = await flight.fetch(`/api/connection/${readonlyConnId}`, {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                enabled: true
            }
        }, true);

        assert.equal(res.body.enabled, false);
        assert.equal(res.body.readonly, true);
    } catch (err) {
        assert.ifError(err);
    }
});

test('PATCH: api/connection/:connectionid - Disable enabled connection', async () => {
    try {
        const res = await flight.fetch(`/api/connection/${enabledConnId}`, {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                enabled: false
            }
        }, true);

        assert.equal(res.body.enabled, false);
    } catch (err) {
        assert.ifError(err);
    }
});

test('PATCH: api/connection/:connectionid - Enable when not in pool', async () => {
    try {
        const res = await flight.fetch(`/api/connection/${enabledConnId}`, {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                enabled: true
            }
        }, true);

        assert.equal(res.body.enabled, true);

        await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (err) {
        assert.ifError(err);
    }
});

test('PATCH: api/connection/:connectionid - Re-enable already connected (reconnect)', async () => {
    try {
        const res = await flight.fetch(`/api/connection/${enabledConnId}`, {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                enabled: true
            }
        }, true);

        assert.equal(res.body.enabled, true);

        await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (err) {
        assert.ifError(err);
    }
});

test('PATCH: api/connection/:connectionid - Non-admin agency change rejected', async () => {
    try {
        await flight.config!.models.Connection.commit(enabledConnId, { agency: 1 });
        await flight.config!.models.Profile.commit('user@example.com', {
            agency_admin: [1]
        });

        const res = await flight.fetch(`/api/connection/${enabledConnId}`, {
            method: 'PATCH',
            auth: {
                bearer: flight.token.user
            },
            body: {
                agency: 2
            }
        }, false);

        assert.equal(res.status, 401);

        await flight.config!.models.Connection.commit(enabledConnId, { agency: null });
        await flight.config!.models.Profile.commit('user@example.com', {
            agency_admin: []
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/connection/refresh - Non-admin rejected', async () => {
    try {
        const res = await flight.fetch('/api/connection/refresh', {
            method: 'POST',
            auth: {
                bearer: flight.token.user
            }
        }, false);

        assert.equal(res.status, 403);
        assert.equal(res.body.message, 'Only System Admins can refresh all connections');
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/connection/refresh - Admin', async () => {
    try {
        const res = await flight.fetch('/api/connection/refresh', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        assert.deepEqual(res.body, {
            status: 200,
            message: 'Connections Refreshed'
        });

        await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/connection/:connectionid/refresh - Disabled connection rejected', async () => {
    try {
        const res = await flight.fetch(`/api/connection/${readonlyConnId}/refresh`, {
            method: 'POST',
            auth: {
                bearer: flight.token.admin
            }
        }, false);

        assert.equal(res.status, 400);
        assert.equal(res.body.message, 'Connection is not currently enabled');
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/connection/:connectionid/refresh - Enabled connection', async () => {
    try {
        const res = await flight.fetch(`/api/connection/${enabledConnId}/refresh`, {
            method: 'POST',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        assert.equal(res.body.id, enabledConnId);
        assert.ok(res.body.certificate, 'has certificate');

        await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/connection/:connectionid/auth - Non-readonly connection rejected', async () => {
    try {
        const res = await flight.fetch(`/api/connection/${enabledConnId}/auth?password=test123&type=client`, {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, false);

        assert.equal(res.status, 400);
        assert.equal(res.body.message, 'Connection is not ReadOnly and cannot return auth');
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/connection/:connectionid/auth - Readonly client P12', async () => {
    try {
        const res = await flight.fetch(`/api/connection/${readonlyConnId}/auth?password=test123&type=client`, {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, { verify: false, json: false, binary: true });

        assert.ok(res.ok, 'Request succeeded');
        assert.equal(res.headers.get('content-type'), 'application/x-pkcs12');
        assert.ok(res.body.byteLength > 0, 'Response has binary content');
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/connection/:connectionid/auth - Readonly truststore P12', async () => {
    try {
        const res = await flight.fetch(`/api/connection/${readonlyConnId}/auth?password=test123&type=truststore`, {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, { verify: false, json: false, binary: true });

        assert.ok(res.ok, 'Request succeeded');
        assert.equal(res.headers.get('content-type'), 'application/x-pkcs12');
        assert.ok(res.body.byteLength > 0, 'Response has binary content');
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/connection/:connectionid/auth - Readonly client P12 with download', async () => {
    try {
        const res = await flight.fetch(`/api/connection/${readonlyConnId}/auth?password=test123&type=client&download=true`, {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, { verify: false, json: false, binary: true });

        assert.ok(res.ok, 'Request succeeded');
        assert.equal(res.headers.get('content-type'), 'application/x-pkcs12');
        const disposition = res.headers.get('content-disposition');
        assert.ok(disposition, 'Has Content-Disposition header');
        assert.ok(disposition!.includes('attachment'), 'Content-Disposition includes attachment');
        assert.ok(disposition!.includes('.p12'), 'Content-Disposition includes .p12');
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/connection/:connectionid/auth - Readonly truststore P12 with download', async () => {
    try {
        const res = await flight.fetch(`/api/connection/${readonlyConnId}/auth?password=test123&type=truststore&download=true`, {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, { verify: false, json: false, binary: true });

        assert.ok(res.ok, 'Request succeeded');
        assert.equal(res.headers.get('content-type'), 'application/x-pkcs12');
        const disposition = res.headers.get('content-disposition');
        assert.ok(disposition, 'Has Content-Disposition header');
        assert.ok(disposition!.includes('truststore'), 'Content-Disposition includes truststore');
    } catch (err) {
        assert.ifError(err);
    }
});

test('DELETE: api/connection/:connectionid - Fails with active Layer', async () => {
    const layer = await flight.config!.models.Layer.generate({
        name: 'Guard Layer',
        task: 'test-task',
        connection: enabledConnId
    });

    const s3Stub = Sinon.stub(S3, 'del').resolves();
    try {
        const res = await flight.fetch(`/api/connection/${enabledConnId}`, {
            method: 'DELETE',
            auth: {
                bearer: flight.token.admin
            }
        }, false);

        assert.equal(res.status, 400);
        assert.equal(res.body.message, 'Connection has active Layers - Delete layers before deleting Connection');
    } finally {
        s3Stub.restore();
    }

    await flight.config!.models.Layer.delete(layer.id);
});

test('DELETE: api/connection/:connectionid - Fails with active Data Sync', async () => {
    const data = await flight.config!.models.Data.generate({
        name: 'Guard Data',
        connection: enabledConnId
    });

    const s3Stub = Sinon.stub(S3, 'del').resolves();
    try {
        const res = await flight.fetch(`/api/connection/${enabledConnId}`, {
            method: 'DELETE',
            auth: {
                bearer: flight.token.admin
            }
        }, false);

        assert.equal(res.status, 400);
        assert.equal(res.body.message, 'Connection has active Data Syncs - Delete Syncs before deleting Connection');
    } finally {
        s3Stub.restore();
    }

    await flight.config!.models.Data.delete(data.id);
});

test('DELETE: api/connection/:connectionid - Fails with active Video Lease', async () => {
    const lease = await flight.config!.models.VideoLease.generate({
        name: 'Guard Lease',
        path: '/test/path',
        connection: enabledConnId
    });

    const s3Stub = Sinon.stub(S3, 'del').resolves();
    try {
        const res = await flight.fetch(`/api/connection/${enabledConnId}`, {
            method: 'DELETE',
            auth: {
                bearer: flight.token.admin
            }
        }, false);

        assert.equal(res.status, 400);
        assert.equal(res.body.message, 'Connection has active Video LEases - Delete Leases before deleting Connection');
    } finally {
        s3Stub.restore();
    }

    await flight.config!.models.VideoLease.delete(lease.id);
});

test('DELETE: api/connection/:connectionid - Success', async () => {
    const s3Stub = Sinon.stub(S3, 'del').resolves();
    try {
        const res = await flight.fetch(`/api/connection/${enabledConnId}`, {
            method: 'DELETE',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        assert.deepEqual(res.body, {
            status: 200,
            message: 'Connection Deleted'
        });
    } finally {
        s3Stub.restore();
    }
});

test('DELETE: api/connection/:connectionid - Readonly connection', async () => {
    const s3Stub = Sinon.stub(S3, 'del').resolves();
    try {
        const res = await flight.fetch(`/api/connection/${readonlyConnId}`, {
            method: 'DELETE',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        assert.deepEqual(res.body, {
            status: 200,
            message: 'Connection Deleted'
        });
    } finally {
        s3Stub.restore();
    }
});

flight.landing();

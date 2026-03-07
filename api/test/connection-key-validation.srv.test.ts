import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';
import fs from 'fs';
import CP from 'node:child_process';

const flight = new Flight();

flight.init({ takserver: true });
flight.takeoff();
flight.user();

test('POST: api/connection - Invalid X509 Certificate', async () => {
    const key = String(fs.readFileSync(flight.tak.keys.key));

    const res = await flight.fetch('/api/connection', {
        method: 'POST',
        auth: {
            bearer: flight.token.admin
        },
        body: {
            name: 'Bad Cert Connection',
            description: 'test',
            auth: {
                cert: '-----BEGIN CERTIFICATE-----\nINVALID\n-----END CERTIFICATE-----',
                key: key
            }
        }
    }, false);

    assert.equal(res.status, 400);
    assert.equal(res.body.message, 'Invalid X509 Certificate Provided');
    assert.equal(flight.tak.martiRequests.length, 0, 'No calls should be made to the TAK server for an invalid cert');
});

test('POST: api/connection - Invalid Private Key', async () => {
    const cert = String(fs.readFileSync(flight.tak.keys.cert));

    const res = await flight.fetch('/api/connection', {
        method: 'POST',
        auth: {
            bearer: flight.token.admin
        },
        body: {
            name: 'Bad Key Connection',
            description: 'test',
            auth: {
                cert: cert,
                key: '-----BEGIN PRIVATE KEY-----\nINVALID\n-----END PRIVATE KEY-----'
            }
        }
    }, false);

    assert.equal(res.status, 400);
    assert.equal(res.body.message, 'Invalid Private Key Provided');
    assert.equal(flight.tak.martiRequests.length, 0, 'No calls should be made to the TAK server for an invalid key');
});

test('PATCH: api/connection/:id - Invalid Private Key', async () => {
    // Generate valid keys for initial creation
    CP.execSync(`
        openssl req \
            -newkey rsa:4096 \
            -keyout /tmp/cloudtak-test-patch.key \
            -out /tmp/cloudtak-test-patch.csr \
            -nodes \
            -subj "/CN=Patch" \
            2> /dev/null
    `);

    CP.execSync(`
       openssl x509 \
            -req \
            -in /tmp/cloudtak-test-patch.csr \
            -CA ${flight.tak.keys.cert} \
            -CAkey ${flight.tak.keys.key} \
            -out /tmp/cloudtak-test-patch.cert \
            -set_serial 02 \
            -days 365 \
            2> /dev/null
    `);

    const validKey = String(fs.readFileSync('/tmp/cloudtak-test-patch.key'));
    const validCert = String(fs.readFileSync('/tmp/cloudtak-test-patch.cert'));

    // Create Connection with enabled=false to avoid auto-connecting to TAK server
    const createRes = await flight.fetch('/api/connection', {
        method: 'POST',
        auth: {
            bearer: flight.token.admin
        },
        body: {
            name: 'Patch Connection',
            description: 'test',
            enabled: false,
            auth: {
                cert: validCert,
                key: validKey
            }
        }
    }, true);
    
    const connId = createRes.body.id;

    // PATCH with invalid cert
    const certRes = await flight.fetch(`/api/connection/${connId}`, {
        method: 'PATCH',
        auth: {
            bearer: flight.token.admin
        },
        body: {
            auth: {
                cert: '-----BEGIN CERTIFICATE-----\nINVALID\n-----END CERTIFICATE-----',
                key: validKey
            }
        }
    }, false);

    assert.equal(certRes.status, 400);
    assert.equal(certRes.body.message, 'Invalid X509 Certificate Provided');

    // PATCH with invalid key
    const res = await flight.fetch(`/api/connection/${connId}`, {
        method: 'PATCH',
        auth: {
            bearer: flight.token.admin
        },
        body: {
            auth: {
                cert: validCert,
                key: '-----BEGIN PRIVATE KEY-----\nINVALID\n-----END PRIVATE KEY-----'
            }
        }
    }, false);

    assert.equal(res.status, 400);
    assert.equal(res.body.message, 'Invalid Private Key Provided');
    assert.equal(flight.tak.martiRequests.length, 0, 'No calls should be made to the TAK server for an invalid key');
});

flight.landing();

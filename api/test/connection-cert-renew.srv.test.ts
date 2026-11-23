import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import Sinon from 'sinon';
import Flight from './flight.js';
import AuthentikProvider from '../stateless/lib/authentik-provider.js';
const flight = new Flight();
flight.init({ takserver: true });
flight.takeoff();
flight.user();
flight.server('admin@example.com', 'password123');
const env = { ...process.env };
const renewed = { cert: 'NEW CERT', key: 'NEW KEY', ca: ['NEW CA 0', 'NEW CA 1'] };
let authentik: { fetchMachineUser: Sinon.SinonStub; renewConnectionCertificate: Sinon.SinonStub };
let init: Sinon.SinonStub;
test.before(() => {
    authentik = {
        fetchMachineUser: Sinon.stub().resolves({ id: 42, email: 'etl-agency1-renew', integrations: [] }),
        renewConnectionCertificate: Sinon.stub().resolves(renewed),
    };
    init = Sinon.stub(AuthentikProvider, 'init').resolves(authentik as unknown as AuthentikProvider);
});
test.after(() => {
    init.restore();
    process.env = env;
});
/** Connections are disabled so nothing connects to the mock TAK Server */
async function create(name: string, subject: string, user: string): Promise<number> {
    flight.clientCert(user, subject);
    const res = await flight.fetch('/api/connection', {
        method: 'POST',
        auth: { bearer: flight.token.admin },
        body: {
            name,
            description: 'cert renewal',
            enabled: false,
            auth: {
                key: String(fs.readFileSync(`/tmp/cloudtak-test-${user}.key`)),
                cert: String(fs.readFileSync(`/tmp/cloudtak-test-${user}.cert`)),
                ca: ['OLD CA'],
            },
        },
    }, true);
    return res.body.id;
}
let machine: number;
let human: number;
test('POST: api/connection/:id/cert/renew - without Authentik there is nothing to renew with', async () => {
    delete process.env.AUTHENTIK_URL;
    delete process.env.AUTHENTIK_API_TOKEN_SECRET_ARN;
    machine = await create('Renew Machine', '/CN=etl-agency1-renew', 'etl-agency1-renew');
    human = await create('Renew Human', '/CN=Alice', 'alice');
    const res = await flight.fetch(`/api/connection/${machine}/cert/renew?force=true`, {
        method: 'POST',
        auth: { bearer: flight.token.admin },
    }, false);
    assert.equal(res.body.renewed, false);
    assert.equal(authentik.fetchMachineUser.called, false);
});
test('POST: api/connection/:id/cert/renew - a valid certificate is left alone unless forced', async () => {
    process.env.AUTHENTIK_URL = 'https://authentik.example.com';
    process.env.AUTHENTIK_API_TOKEN_SECRET_ARN = 'arn:aws:secretsmanager:us-west-2:123456789012:secret:token';
    const res = await flight.fetch(`/api/connection/${machine}/cert/renew`, {
        method: 'POST',
        auth: { bearer: flight.token.admin },
    }, false);
    assert.deepEqual(res.body, { renewed: false, message: 'Certificate does not need renewal' });
    assert.equal(authentik.renewConnectionCertificate.called, false);
});
test('POST: api/connection/:id/cert/renew?force=true - renews the machine user named in the certificate, not the creator', async () => {
    const res = await flight.fetch(`/api/connection/${machine}/cert/renew?force=true`, {
        method: 'POST',
        auth: { bearer: flight.token.admin },
    }, false);
    assert.equal(res.body.renewed, true);
    // The creator is admin@example.com; only the CN identifies the machine user
    assert.deepEqual(authentik.fetchMachineUser.firstCall.args, [0, 'etl-agency1-renew']);
    assert.equal(authentik.renewConnectionCertificate.firstCall.args[0], 42);
    const stored = await flight.config!.models.Connection.from(machine);
    assert.equal(stored.auth.cert, renewed.cert);
    assert.equal(stored.auth.key, renewed.key);
    assert.deepEqual(stored.auth.ca, renewed.ca, 'the CA chain from the new enrollment replaces the old one');
});
test('POST: api/connection/:id/cert/renew?force=true - never touches a connection that is not a machine user', async () => {
    authentik.fetchMachineUser.resetHistory();
    authentik.renewConnectionCertificate.resetHistory();
    const res = await flight.fetch(`/api/connection/${human}/cert/renew?force=true`, {
        method: 'POST',
        auth: { bearer: flight.token.admin },
    }, false);
    assert.equal(res.status, 400);
    assert.equal(res.body.message, 'Connection is not managed by a Machine User');
    assert.equal(authentik.fetchMachineUser.called, false);
    assert.equal(authentik.renewConnectionCertificate.called, false);
});
flight.landing();

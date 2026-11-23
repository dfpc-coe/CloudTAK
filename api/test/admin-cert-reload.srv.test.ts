import test from 'node:test';
import assert from 'node:assert';
import Sinon from 'sinon';
import CP from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import SecretsManager from '@aws-sdk/client-secrets-manager';
import { APIAuthCertificate } from '@tak-ps/node-tak';
import Flight from './flight.js';
import type Config from '../common/config.js';
import TAKServerControl, { isTransportRejection } from '../common/control/takserver.js';
const flight = new Flight();
flight.init({ takserver: true });
flight.takeoff();
flight.user();
flight.server('admin@example.com', 'password123');
/** A throwaway admin certificate as the P12 the secret holds */
function adminP12(cn: string): { p12: Buffer; cert: string } {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'admin-cert-'));
    try {
        const file = (name: string) => path.join(dir, name);
        CP.execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-subj', `/CN=${cn}`, '-keyout', file('k.pem'), '-out', file('c.pem')], { stdio: 'ignore' });
        CP.execFileSync('openssl', ['pkcs12', '-export', '-inkey', file('k.pem'), '-in', file('c.pem'), '-out', file('a.p12'), '-passout', 'pass:atakatak'], { stdio: 'ignore' });
        return { p12: fs.readFileSync(file('a.p12')), cert: fs.readFileSync(file('c.pem'), 'utf8') };
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}
const same = (a: string, b: string) => a.replace(/\s+/g, '') === b.replace(/\s+/g, '');
const first = adminP12('admin-one');
const second = adminP12('admin-two');
let secret: Buffer | Error = first.p12;
let send: Sinon.SinonStub;
const env = { ...process.env };
test.before(() => {
    process.env.CLOUDTAK_Server_auth_p12_secret_arn = 'arn:aws:secretsmanager:us-west-2:123456789012:secret:admin';
    process.env.CLOUDTAK_Server_auth_password = 'atakatak';
    delete process.env.CLOUDTAK_Server_auth_cert;
    delete process.env.CLOUDTAK_Server_auth_key;
    send = Sinon.stub(SecretsManager.SecretsManagerClient.prototype, 'send').callsFake(async () => {
        if (secret instanceof Error) throw secret;
        return { SecretBinary: secret };
    });
});
test.after(() => {
    send.restore();
    process.env = env;
});
test('reloadAdminCert: applies the secret, persists it and reports changes only once', async () => {
    const config = flight.config!;
    assert.equal(await config.reloadAdminCert(), true);
    assert.ok(same(config.server.auth.cert!, first.cert));
    const stored = await config.models.Server.from(config.server.id);
    assert.ok(same(stored.auth.cert!, first.cert));
    assert.equal(await config.reloadAdminCert(), false, 'unchanged secret is not a change');
    secret = second.p12;
    assert.equal(await config.reloadAdminCert(), true);
    assert.ok(same(config.server.auth.cert!, second.cert));
    assert.ok(same((await config.models.Server.from(config.server.id)).auth.cert!, second.cert));
});
test('reloadAdminCert: a failed load keeps the certificate in use', async () => {
    const config = flight.config!;
    const before = config.server.auth.cert;
    secret = new Error('AccessDeniedException');
    const error = Sinon.stub(console, 'error');
    try {
        assert.equal(await config.reloadAdminCert(), false);
        assert.ok(error.args.some(a => String(a[0]).includes('AdminCertReloadFailed')));
    } finally {
        error.restore();
    }
    assert.equal(config.server.auth.cert, before);
    assert.ok(same((await config.models.Server.from(config.server.id)).auth.cert!, second.cert));
});
test('reloadAdminCert: another replica having stored the certificate still updates this one', async () => {
    const config = flight.config!;
    secret = first.p12;
    // A sibling replica wrote the new certificate to the database before this one looked
    await config.models.Server.commit(config.server.id, { auth: { ...config.server.auth, cert: first.cert } });
    assert.equal(await config.reloadAdminCert(), true);
    assert.ok(same(config.server.auth.cert!, first.cert));
});
/** Put a configuration on a given certificate through the real loader, so formatting matches what a reload compares */
async function settle(config: Config, p12: Buffer): Promise<void> {
    secret = p12;
    await config.reloadAdminCert('interval');
    Object.assign(config, { adminCertRejectedAt: 0 });
}
test('stateful reloadAdminCert reconnects the admin connection; stateless does so only after a rejection', async () => {
    const hub = Sinon.stub(flight.stateful!.hub, 'serverRefresh').resolves(undefined as never);
    try {
        await settle(flight.stateful!, first.p12);
        await settle(flight.config!, first.p12);
        hub.resetHistory();
        secret = second.p12;
        assert.equal(await flight.stateful!.reloadAdminCert('interval'), true);
        assert.equal(hub.callCount, 1);
        // Stateless shares the stateful hub in tests; an interval reload leaves the reconnect to the stateful poll
        assert.equal(await flight.config!.reloadAdminCert('interval'), true);
        assert.equal(hub.callCount, 1);
        await settle(flight.config!, first.p12);
        secret = second.p12;
        hub.resetHistory();
        assert.equal(await flight.config!.reloadAdminCert('rejected'), true);
        assert.equal(hub.callCount, 1);
    } finally {
        hub.restore();
    }
});
test('asServer: a rejected admin call reloads the certificate and retries once', async () => {
    const config = flight.config!;
    const hub = Sinon.stub(flight.stateful!.hub, 'serverRefresh').resolves(undefined as never);
    await settle(config, first.p12);
    secret = second.p12;
    const seen: string[] = [];
    const base = Sinon.stub(APIAuthCertificate.prototype, 'fetch').callsFake(async function (this: APIAuthCertificate) {
        seen.push(this.cert);
        if (same(this.cert, first.cert)) {
            throw Object.assign(new Error('other side closed'), { code: 'UND_ERR_SOCKET' });
        }
        return { status: 200, headers: new Map(), text: async () => 'ok' } as never;
    });
    try {
        hub.resetHistory();
        const api = await new TAKServerControl(config).asServer();
        const res = await api.fetch(new URL('/Marti/api/version', config.server.api), {}, true) as { status: number };
        assert.equal(res.status, 200);
        assert.equal(seen.length, 2);
        assert.ok(same(seen[0], first.cert));
        assert.ok(same(seen[1], second.cert));
        assert.equal(hub.callCount, 1, 'the stateful admin connection is reconnected');
    } finally {
        base.restore();
        hub.restore();
    }
});
test('asServer: a rejection that a reload cannot fix is raised, not retried forever', async () => {
    const config = flight.config!;
    const hub = Sinon.stub(flight.stateful!.hub, 'serverRefresh').resolves(undefined as never);
    await settle(config, second.p12);
    const base = Sinon.stub(APIAuthCertificate.prototype, 'fetch').rejects(Object.assign(new Error('other side closed'), { code: 'UND_ERR_SOCKET' }));
    try {
        const api = await new TAKServerControl(config).asServer();
        await assert.rejects(api.fetch(new URL('/Marti/api/version', config.server.api), {}, true), /other side closed/);
        assert.equal(base.callCount, 1);
    } finally {
        base.restore();
        hub.restore();
    }
});
test('isTransportRejection: closed sockets and TLS alerts, not refused connections', () => {
    assert.equal(isTransportRejection(Object.assign(new Error('other side closed'), { code: 'UND_ERR_SOCKET' })), true);
    assert.equal(isTransportRejection(new Error('fetch failed', { cause: Object.assign(new Error('tlsv1 alert unknown ca'), { code: 'ERR_SSL_TLSV1_ALERT_UNKNOWN_CA' }) })), true);
    assert.equal(isTransportRejection(new Error('fetch failed', { cause: Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' }) })), false);
    assert.equal(isTransportRejection('nope'), false);
});
flight.landing();

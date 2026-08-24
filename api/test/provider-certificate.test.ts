import test from 'node:test';
import assert from 'node:assert';
import CP from 'node:child_process';
import fs from 'node:fs';
import Provider, { CERT_RENEWAL_WINDOW_MS } from '../stateless/lib/provider.js';

const DAY_MS = 24 * 60 * 60 * 1000;

function selfSigned(name: string, days: number): string {
    const key = `/tmp/cloudtak-test-provider-${name}.key`;
    const cert = `/tmp/cloudtak-test-provider-${name}.cert`;

    CP.execSync(`
        openssl req \
            -x509 \
            -newkey rsa:2048 \
            -keyout ${key} \
            -out ${cert} \
            -nodes \
            -days ${days} \
            -subj "/C=US/ST=CO/O=CloudTAK/CN=${name}" \
            2> /dev/null
    `);

    return String(fs.readFileSync(cert));
}

test('Provider.certificate - parses public metadata', () => {
    const cert = selfSigned('valid', 30);
    const info = Provider.certificate(cert);

    assert.ok(info);
    assert.deepEqual(Object.keys(info).sort(), ['subject', 'validFrom', 'validTo']);
    assert.ok(info.subject.includes('CN=valid'));
    assert.ok(!Number.isNaN(Date.parse(info.validTo)));
});

test('Provider.certificate - unparseable input', () => {
    assert.equal(Provider.certificate(undefined), undefined);
    assert.equal(Provider.certificate(''), undefined);
    assert.equal(Provider.certificate('not a certificate'), undefined);
    assert.equal(Provider.certificate({ cert: 'x' }), undefined);
});

test('Provider.certificateExpired', () => {
    const cert = selfSigned('expiry', 30);
    const validTo = Date.parse(Provider.certificate(cert)!.validTo);

    assert.equal(Provider.certificateExpired(cert), false);
    assert.equal(Provider.certificateExpired(cert, validTo - DAY_MS), false);
    assert.equal(Provider.certificateExpired(cert, validTo + DAY_MS), true);

    assert.equal(Provider.certificateExpired(undefined), true, 'missing cert is treated as expired');
    assert.equal(Provider.certificateExpired('garbage'), true, 'unparseable cert is treated as expired');
});

test('Provider.certificateRenewalRequired - 7 day window', () => {
    const cert = selfSigned('renewal', 30);
    const validTo = Date.parse(Provider.certificate(cert)!.validTo);

    assert.equal(Provider.certificateRenewalRequired(cert), false, '30 day cert does not need renewal');
    assert.equal(Provider.certificateRenewalRequired(cert, validTo - CERT_RENEWAL_WINDOW_MS - DAY_MS), false);
    assert.equal(Provider.certificateRenewalRequired(cert, validTo - CERT_RENEWAL_WINDOW_MS + DAY_MS), true, 'inside the window');
    assert.equal(Provider.certificateRenewalRequired(cert, validTo + DAY_MS), true, 'already expired');

    assert.equal(Provider.certificateRenewalRequired(selfSigned('short', 3)), true, '3 day cert is about to expire');
    assert.equal(Provider.certificateRenewalRequired(undefined), true);
});

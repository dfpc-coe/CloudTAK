import test from 'node:test';
import assert from 'node:assert';
import { isSafeUrl, isPrivateIPv4 } from '../src/safeurl.js';

// ---------------------------------------------------------------------------
// isSafeUrl
// ---------------------------------------------------------------------------

test('isSafeUrl — valid public URLs', async (t) => {
    await t.test('http public URL is safe', () => {
        const r = isSafeUrl('http://example.com/path');
        assert.strictEqual(r.safe, true);
        assert.ok(r.url instanceof URL);
        assert.strictEqual(r.reason, undefined);
    });

    await t.test('https public URL is safe', () => {
        const r = isSafeUrl('https://example.com/path');
        assert.strictEqual(r.safe, true);
    });

    await t.test('URL with port is safe', () => {
        const r = isSafeUrl('https://example.com:8443/api');
        assert.strictEqual(r.safe, true);
    });

    await t.test('URL with query string and fragment is safe', () => {
        const r = isSafeUrl('https://example.com/search?q=foo&page=1#section');
        assert.strictEqual(r.safe, true);
    });

    await t.test('URL with credentials on a safe host is safe', () => {
        const r = isSafeUrl('https://user:pass@example.com/');
        assert.strictEqual(r.safe, true);
    });

    await t.test('subdomain of public host is safe', () => {
        const r = isSafeUrl('https://api.example.com/v2');
        assert.strictEqual(r.safe, true);
    });

    await t.test('well-known public IPs are safe', () => {
        assert.strictEqual(isSafeUrl('http://8.8.8.8/').safe, true);
        assert.strictEqual(isSafeUrl('http://1.1.1.1/').safe, true);
        assert.strictEqual(isSafeUrl('http://93.184.216.34/').safe, true);
    });
});

test('isSafeUrl — invalid / unparseable URLs', async (t) => {
    await t.test('empty string is unsafe', () => {
        const r = isSafeUrl('');
        assert.strictEqual(r.safe, false);
        assert.ok(r.reason?.includes('invalid URL'));
    });

    await t.test('bare hostname is unsafe', () => {
        const r = isSafeUrl('example.com');
        assert.strictEqual(r.safe, false);
        assert.ok(r.reason?.includes('invalid URL'));
    });

    await t.test('path-only string is unsafe', () => {
        const r = isSafeUrl('/etc/passwd');
        assert.strictEqual(r.safe, false);
    });

    await t.test('random garbage string is unsafe', () => {
        const r = isSafeUrl('not a url at all!!');
        assert.strictEqual(r.safe, false);
    });
});

test('isSafeUrl — blocked schemes', async (t) => {
    const blocked = [
        'file:///etc/passwd',
        'ftp://example.com/file',
        'ftps://example.com/file',
        'data:text/html,<script>alert(1)</script>',
        'javascript:alert(1)',
        'about:blank',
        'blob:https://example.com/uuid',
        'custom://example.com/',
        'ssh://example.com/',
        'ldap://example.com/',
    ];

    for (const href of blocked) {
        await t.test(`scheme blocked: ${href.split(':')[0]}://`, () => {
            const r = isSafeUrl(href);
            assert.strictEqual(r.safe, false, `expected ${href} to be unsafe`);
            assert.ok(r.reason?.includes('unsupported protocol'), `expected protocol reason for ${href}`);
        });
    }
});

test('isSafeUrl — blocked hostnames', async (t) => {
    await t.test('localhost is blocked', () => {
        const r = isSafeUrl('http://localhost/');
        assert.strictEqual(r.safe, false);
        assert.ok(r.reason?.includes('blocked hostname'));
    });

    await t.test('LOCALHOST (uppercase) is blocked', () => {
        // URL constructor normalises hostname to lowercase
        const r = isSafeUrl('http://LOCALHOST/');
        assert.strictEqual(r.safe, false);
        assert.ok(r.reason?.includes('blocked hostname'));
    });

    await t.test('localhost with port is blocked', () => {
        const r = isSafeUrl('http://localhost:8080/admin');
        assert.strictEqual(r.safe, false);
        assert.ok(r.reason?.includes('blocked hostname'));
    });

    await t.test('IPv6 loopback ::1 is blocked', () => {
        const r = isSafeUrl('http://[::1]/');
        assert.strictEqual(r.safe, false);
        assert.ok(r.reason?.includes('blocked hostname'));
    });

    await t.test('IPv6 loopback ::1 with port is blocked', () => {
        const r = isSafeUrl('http://[::1]:9200/');
        assert.strictEqual(r.safe, false);
    });

    await t.test('0.0.0.0 is blocked', () => {
        const r = isSafeUrl('http://0.0.0.0/');
        assert.strictEqual(r.safe, false);
        assert.ok(r.reason?.includes('blocked hostname'));
    });
});

test('isSafeUrl — RFC 1918 / loopback / special ranges blocked', async (t) => {
    const blocked: Array<[string, string]> = [
        // loopback 127.0.0.0/8
        ['http://127.0.0.1/', '127.0.0.1'],
        ['http://127.1.2.3/', '127.1.2.3'],
        ['http://127.255.255.255/', '127.255.255.255'],
        // 10.0.0.0/8
        ['http://10.0.0.1/', '10.0.0.1'],
        ['http://10.10.10.10/', '10.10.10.10'],
        ['http://10.255.255.255/', '10.255.255.255'],
        // 172.16.0.0/12  (172.16–172.31)
        ['http://172.16.0.1/', '172.16.0.1'],
        ['http://172.20.0.1/', '172.20.0.1'],
        ['http://172.31.255.255/', '172.31.255.255'],
        // 192.168.0.0/16
        ['http://192.168.0.1/', '192.168.0.1'],
        ['http://192.168.1.2/', '192.168.1.2'],
        ['http://192.168.255.255/', '192.168.255.255'],
        // link-local 169.254.0.0/16
        ['http://169.254.0.1/', '169.254.0.1'],
        ['http://169.254.169.254/', '169.254.169.254'], // AWS/GCP metadata endpoint
        ['http://169.254.255.255/', '169.254.255.255'],
        // CGNAT 100.64.0.0/10  (100.64–100.127)
        ['http://100.64.0.1/', '100.64.0.1'],
        ['http://100.100.0.1/', '100.100.0.1'],
        ['http://100.127.255.255/', '100.127.255.255'],
    ];

    for (const [url, label] of blocked) {
        await t.test(`${label} is blocked`, () => {
            const r = isSafeUrl(url);
            assert.strictEqual(r.safe, false, `expected ${label} to be blocked`);
            assert.ok(r.reason?.includes('blocked private IP'), `expected private IP reason for ${label}`);
        });
    }
});

test('isSafeUrl — IPs just outside private ranges are allowed', async (t) => {
    const allowed: Array<[string, string]> = [
        // Just above 10.255.255.255
        ['http://11.0.0.1/', '11.0.0.1'],
        // Just below 172.16 and just above 172.31
        ['http://172.15.255.255/', '172.15.255.255'],
        ['http://172.32.0.1/', '172.32.0.1'],
        // Just below CGNAT and just above CGNAT
        ['http://100.63.255.255/', '100.63.255.255'],
        ['http://100.128.0.1/', '100.128.0.1'],
        // Just below link-local
        ['http://169.253.255.255/', '169.253.255.255'],
        // Above link-local
        ['http://169.255.0.1/', '169.255.0.1'],
    ];

    for (const [url, label] of allowed) {
        await t.test(`${label} is NOT in a private range`, () => {
            const r = isSafeUrl(url);
            assert.strictEqual(r.safe, true, `expected ${label} to be safe`);
        });
    }
});

// ---------------------------------------------------------------------------
// isPrivateIPv4
// ---------------------------------------------------------------------------

test('isPrivateIPv4 — loopback 127.0.0.0/8', async (t) => {
    await t.test('127.0.0.1', () => assert.strictEqual(isPrivateIPv4('127.0.0.1'), true));
    await t.test('127.0.0.0', () => assert.strictEqual(isPrivateIPv4('127.0.0.0'), true));
    await t.test('127.255.255.255', () => assert.strictEqual(isPrivateIPv4('127.255.255.255'), true));
    await t.test('128.0.0.1 is NOT loopback', () => assert.strictEqual(isPrivateIPv4('128.0.0.1'), false));
});

test('isPrivateIPv4 — RFC 1918 10.0.0.0/8', async (t) => {
    await t.test('10.0.0.0', () => assert.strictEqual(isPrivateIPv4('10.0.0.0'), true));
    await t.test('10.0.0.1', () => assert.strictEqual(isPrivateIPv4('10.0.0.1'), true));
    await t.test('10.255.255.255', () => assert.strictEqual(isPrivateIPv4('10.255.255.255'), true));
    await t.test('9.255.255.255 is NOT 10/8', () => assert.strictEqual(isPrivateIPv4('9.255.255.255'), false));
    await t.test('11.0.0.0 is NOT 10/8', () => assert.strictEqual(isPrivateIPv4('11.0.0.0'), false));
});

test('isPrivateIPv4 — RFC 1918 172.16.0.0/12', async (t) => {
    await t.test('172.16.0.1', () => assert.strictEqual(isPrivateIPv4('172.16.0.1'), true));
    await t.test('172.20.0.0', () => assert.strictEqual(isPrivateIPv4('172.20.0.0'), true));
    await t.test('172.31.255.255', () => assert.strictEqual(isPrivateIPv4('172.31.255.255'), true));
    await t.test('172.15.255.255 is below range', () => assert.strictEqual(isPrivateIPv4('172.15.255.255'), false));
    await t.test('172.32.0.0 is above range', () => assert.strictEqual(isPrivateIPv4('172.32.0.0'), false));
    await t.test('171.16.0.1 wrong first octet', () => assert.strictEqual(isPrivateIPv4('171.16.0.1'), false));
});

test('isPrivateIPv4 — RFC 1918 192.168.0.0/16', async (t) => {
    await t.test('192.168.0.0', () => assert.strictEqual(isPrivateIPv4('192.168.0.0'), true));
    await t.test('192.168.1.1', () => assert.strictEqual(isPrivateIPv4('192.168.1.1'), true));
    await t.test('192.168.255.255', () => assert.strictEqual(isPrivateIPv4('192.168.255.255'), true));
    await t.test('192.167.255.255 is below range', () => assert.strictEqual(isPrivateIPv4('192.167.255.255'), false));
    await t.test('192.169.0.0 is above range', () => assert.strictEqual(isPrivateIPv4('192.169.0.0'), false));
});

test('isPrivateIPv4 — link-local 169.254.0.0/16', async (t) => {
    await t.test('169.254.0.1', () => assert.strictEqual(isPrivateIPv4('169.254.0.1'), true));
    await t.test('169.254.169.254 (metadata)', () => assert.strictEqual(isPrivateIPv4('169.254.169.254'), true));
    await t.test('169.254.255.255', () => assert.strictEqual(isPrivateIPv4('169.254.255.255'), true));
    await t.test('169.253.255.255 is below range', () => assert.strictEqual(isPrivateIPv4('169.253.255.255'), false));
    await t.test('169.255.0.0 is above range', () => assert.strictEqual(isPrivateIPv4('169.255.0.0'), false));
});

test('isPrivateIPv4 — CGNAT 100.64.0.0/10', async (t) => {
    await t.test('100.64.0.0', () => assert.strictEqual(isPrivateIPv4('100.64.0.0'), true));
    await t.test('100.64.0.1', () => assert.strictEqual(isPrivateIPv4('100.64.0.1'), true));
    await t.test('100.100.0.1', () => assert.strictEqual(isPrivateIPv4('100.100.0.1'), true));
    await t.test('100.127.255.255', () => assert.strictEqual(isPrivateIPv4('100.127.255.255'), true));
    await t.test('100.63.255.255 is below range', () => assert.strictEqual(isPrivateIPv4('100.63.255.255'), false));
    await t.test('100.128.0.0 is above range', () => assert.strictEqual(isPrivateIPv4('100.128.0.0'), false));
});

test('isPrivateIPv4 — public IPs', async (t) => {
    const publicIPs = ['8.8.8.8', '1.1.1.1', '93.184.216.34', '151.101.1.140', '0.0.0.0', '255.255.255.255'];
    for (const ip of publicIPs) {
        await t.test(`${ip} is NOT private`, () => {
            assert.strictEqual(isPrivateIPv4(ip), false);
        });
    }
});

test('isPrivateIPv4 — invalid / non-IPv4 inputs', async (t) => {
    const invalid = [
        '',
        'localhost',
        '::1',
        'example.com',
        '256.0.0.1',       // octet out of range
        '-1.0.0.1',        // negative octet
        '1.2.3',           // too few octets
        '1.2.3.4.5',       // too many octets
        '1.2.3.abc',       // non-numeric octet
        '1.2.3.',          // trailing dot
        '.1.2.3',          // leading dot
        '1.2.3.4/24',      // CIDR notation
        'NaN.0.0.1',
    ];

    for (const input of invalid) {
        await t.test(`"${input}" returns false`, () => {
            assert.strictEqual(isPrivateIPv4(input), false, `expected isPrivateIPv4(${JSON.stringify(input)}) to be false`);
        });
    }
});

// Number() coerces whitespace-padded strings and strips leading zeros (e.g. "01" → 1),
// so these inputs are accepted by the parser and match private ranges as expected.
// In practice, URL.hostname never produces such forms, but the behavior is documented here.
test('isPrivateIPv4 — Number() coercion edge cases', async (t) => {
    await t.test('"  10.0.0.1  " is treated as 10.0.0.1 (private)', () => {
        assert.strictEqual(isPrivateIPv4('  10.0.0.1  '), true);
    });

    await t.test('"10.0.0.01" is treated as 10.0.0.1 (private)', () => {
        assert.strictEqual(isPrivateIPv4('10.0.0.01'), true);
    });
});

import test from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import fs from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const exec = promisify(execFile);

// nginx.conf.js lives at the api root and is not part of the TS build, so it is
// not copied into dist/. Depending on whether the test runs from source
// (test/) via tsx or from the compiled output (dist/test/) via the coverage
// script, the script sits one or two directories up. Resolve to whichever
// candidate actually exists.
const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = [
    path.resolve(TEST_DIR, '../nginx.conf.js'),
    path.resolve(TEST_DIR, '../../nginx.conf.js'),
].find(candidate => fs.existsSync(candidate))
?? path.resolve(TEST_DIR, '../nginx.conf.js');
const CSP_REGEX = /add_header 'Content-Security-Policy' "[^"]+" always;/;

test('nginx.conf: fails when API_URL is not set', async () => {
    const env: Record<string, string | undefined> = { ...process.env };
    delete env.API_URL;

    await assert.rejects(exec(process.execPath, [SCRIPT], { env }), (err: Error & { code: number; stderr: string }) => {
        assert.notEqual(err.code, 0);
        assert.match(err.stderr, /API_URL environment variable is not set/);
        return true;
    });
});

test('nginx.conf: fails when API_URL is not a valid URL', async () => {
    await assert.rejects(exec(process.execPath, [SCRIPT], {
        env: { ...process.env, API_URL: 'not-a-url' },
    }), (err: Error & { code: number; stderr: string }) => {
        assert.notEqual(err.code, 0);
        assert.match(err.stderr, /Invalid URL/);
        return true;
    });
});

test('nginx.conf: localhost over http disables CSP and HSTS', async () => {
    const { stdout } = await exec(process.execPath, [SCRIPT], {
        env: { ...process.env, API_URL: 'http://localhost:5000' },
    });

    assert.ok(!stdout.includes('Content-Security-Policy'));
    assert.ok(!stdout.includes('Strict-Transport-Security'));
});

test('nginx.conf: localhost over https disables CSP but keeps HSTS', async () => {
    const { stdout } = await exec(process.execPath, [SCRIPT], {
        env: { ...process.env, API_URL: 'https://localhost:5000' },
    });

    assert.ok(!stdout.includes('Content-Security-Policy'));
    assert.ok(stdout.includes(`add_header 'Strict-Transport-Security' 'max-age=31536000; includeSubDomains; preload' always;`));
});

test('nginx.conf: https subdomain produces full CSP with wildcard parent domain', async () => {
    const { stdout } = await exec(process.execPath, [SCRIPT], {
        env: { ...process.env, API_URL: 'https://map.example.com' },
    });

    const csp = stdout.match(CSP_REGEX);
    assert.ok(csp, 'Config should contain a Content-Security-Policy header');

    assert.equal(
        csp[0],
        `add_header 'Content-Security-Policy' "`
        + `default-src 'self' map.example.com:* *.example.com:*; `
        + `img-src 'self' data: blob: map.example.com:* *.example.com:*; `
        + `media-src 'self' blob: map.example.com:* *.example.com:*; `
        + `font-src 'self' data:; `
        + `worker-src 'self' blob:; `
        + `style-src-elem 'self' 'unsafe-inline'; `
        + `style-src-attr 'unsafe-inline'; `
        + `connect-src 'self' map.example.com:* *.example.com:*;`
        + `upgrade-insecure-requests;" always;`,
    );
});

test('nginx.conf: bare domain gets its own host without a wildcard subdomain source', async () => {
    const { stdout } = await exec(process.execPath, [SCRIPT], {
        env: { ...process.env, API_URL: 'https://example.com' },
    });

    const csp = stdout.match(CSP_REGEX);
    assert.ok(csp, 'Config should contain a Content-Security-Policy header');

    assert.ok(csp[0].includes(`default-src 'self' example.com:*;`));
    assert.ok(csp[0].includes(`connect-src 'self' example.com:*;`));
    assert.ok(!csp[0].includes('*.com'));
    assert.ok(!csp[0].includes('*.example.com'));
});

test('nginx.conf: multi-level subdomain wildcards only the first label', async () => {
    const { stdout } = await exec(process.execPath, [SCRIPT], {
        env: { ...process.env, API_URL: 'https://map.stage.example.com' },
    });

    const csp = stdout.match(CSP_REGEX);
    assert.ok(csp, 'Config should contain a Content-Security-Policy header');

    assert.ok(csp[0].includes(`connect-src 'self' map.stage.example.com:* *.stage.example.com:*;`));
});

test('nginx.conf: IPv4 host is used verbatim without a wildcard source', async () => {
    const { stdout } = await exec(process.execPath, [SCRIPT], {
        env: { ...process.env, API_URL: 'http://192.168.1.10:5000' },
    });

    const csp = stdout.match(CSP_REGEX);
    assert.ok(csp, 'Config should contain a Content-Security-Policy header');

    assert.ok(csp[0].includes(`default-src 'self' 192.168.1.10:*;`));
    assert.ok(csp[0].includes(`img-src 'self' data: blob: 192.168.1.10:*;`));
    assert.ok(csp[0].includes(`media-src 'self' blob: 192.168.1.10:*;`));
    assert.ok(csp[0].includes(`connect-src 'self' 192.168.1.10:*;`));
    assert.ok(!csp[0].includes('*.168.1.10'));
});

test('nginx.conf: host source is only added to network directives', async () => {
    const { stdout } = await exec(process.execPath, [SCRIPT], {
        env: { ...process.env, API_URL: 'https://map.example.com' },
    });

    const csp = stdout.match(CSP_REGEX);
    assert.ok(csp, 'Config should contain a Content-Security-Policy header');

    assert.ok(csp[0].includes(`font-src 'self' data:;`));
    assert.ok(csp[0].includes(`worker-src 'self' blob:;`));
    assert.ok(csp[0].includes(`style-src-elem 'self' 'unsafe-inline';`));
    assert.ok(csp[0].includes(`style-src-attr 'unsafe-inline';`));
});

test('nginx.conf: port in API_URL does not leak into CSP host sources', async () => {
    const { stdout } = await exec(process.execPath, [SCRIPT], {
        env: { ...process.env, API_URL: 'https://map.example.com:8443' },
    });

    const csp = stdout.match(CSP_REGEX);
    assert.ok(csp, 'Config should contain a Content-Security-Policy header');

    assert.ok(csp[0].includes(`connect-src 'self' map.example.com:* *.example.com:*;`));
    assert.ok(!csp[0].includes('8443'));
});

test('nginx.conf: http (non-localhost) omits upgrade-insecure-requests and HSTS', async () => {
    const { stdout } = await exec(process.execPath, [SCRIPT], {
        env: { ...process.env, API_URL: 'http://map.example.com' },
    });

    const csp = stdout.match(CSP_REGEX);
    assert.ok(csp, 'Config should contain a Content-Security-Policy header');

    assert.ok(!csp[0].includes('upgrade-insecure-requests'));
    assert.ok(!stdout.includes('Strict-Transport-Security'));
});

test('nginx.conf: https adds upgrade-insecure-requests and HSTS', async () => {
    const { stdout } = await exec(process.execPath, [SCRIPT], {
        env: { ...process.env, API_URL: 'https://map.example.com' },
    });

    const csp = stdout.match(CSP_REGEX);
    assert.ok(csp, 'Config should contain a Content-Security-Policy header');

    assert.ok(csp[0].includes('upgrade-insecure-requests;'));
    assert.ok(stdout.includes(`add_header 'Strict-Transport-Security' 'max-age=31536000; includeSubDomains; preload' always;`));
});

test('nginx.conf: CSP and HSTS are repeated in the server block and each add_header location', async () => {
    const { stdout } = await exec(process.execPath, [SCRIPT], {
        env: { ...process.env, API_URL: 'https://map.example.com' },
    });

    // server block + `= /` + /admin + /connection + /assets/
    assert.equal(stdout.split(`add_header 'Content-Security-Policy'`).length - 1, 5);
    assert.equal(stdout.split(`add_header 'Strict-Transport-Security'`).length - 1, 5);
});

test('nginx.conf: static server configuration', async () => {
    const { stdout } = await exec(process.execPath, [SCRIPT], {
        env: { ...process.env, API_URL: 'https://map.example.com' },
    });

    assert.ok(stdout.includes('listen 5000;'));
    assert.ok(stdout.includes('listen [::]:5000;'));
    assert.ok(stdout.includes('server_tokens off;'));
    assert.ok(stdout.includes('client_max_body_size 5G;'));
    assert.ok(stdout.includes('absolute_redirect off;'));

    assert.ok(stdout.includes(`add_header 'X-Content-Type-Options' 'nosniff' always;`));
    assert.ok(stdout.includes(`add_header 'X-Frame-Options' 'DENY' always;`));
    assert.ok(stdout.includes(`add_header 'Referrer-Policy' 'strict-origin-when-cross-origin' always;`));
    assert.ok(stdout.includes(`add_header 'Permissions-Policy' 'fullscreen=(self), geolocation=(self), clipboard-read=(self), clipboard-write=(self)' always;`));
});

test('nginx.conf: NGINX_CSP_* appends sources to a single directive', async () => {
    const { stdout } = await exec(process.execPath, [SCRIPT], {
        env: {
            ...process.env,
            API_URL: 'https://map.example.com',
            NGINX_CSP_IMG_SRC: 'https://tiles.example.com',
        },
    });

    const csp = stdout.match(CSP_REGEX);
    assert.ok(csp, 'Config should contain a Content-Security-Policy header');

    assert.ok(csp[0].includes(`img-src 'self' data: blob: https://tiles.example.com map.example.com:* *.example.com:*;`));

    // Other directives are untouched
    assert.ok(csp[0].includes(`media-src 'self' blob: map.example.com:* *.example.com:*;`));
    assert.ok(csp[0].includes(`connect-src 'self' map.example.com:* *.example.com:*;`));
});

test('nginx.conf: NGINX_CSP_* CSV values are split, trimmed and empties dropped', async () => {
    const { stdout } = await exec(process.execPath, [SCRIPT], {
        env: {
            ...process.env,
            API_URL: 'https://map.example.com',
            NGINX_CSP_CONNECT_SRC: ' https://a.example.com , wss://b.example.com:8443, ,',
        },
    });

    const csp = stdout.match(CSP_REGEX);
    assert.ok(csp, 'Config should contain a Content-Security-Policy header');

    assert.ok(csp[0].includes(`connect-src 'self' https://a.example.com wss://b.example.com:8443 map.example.com:* *.example.com:*;`));
});

test('nginx.conf: NGINX_CSP_* augments multiple directives at once', async () => {
    const { stdout } = await exec(process.execPath, [SCRIPT], {
        env: {
            ...process.env,
            API_URL: 'https://map.example.com',
            NGINX_CSP_MEDIA_SRC: 'https://video.example.com',
            NGINX_CSP_STYLE_SRC_ELEM: `'unsafe-eval'`,
        },
    });

    const csp = stdout.match(CSP_REGEX);
    assert.ok(csp, 'Config should contain a Content-Security-Policy header');

    assert.ok(csp[0].includes(`media-src 'self' blob: https://video.example.com map.example.com:* *.example.com:*;`));
    assert.ok(csp[0].includes(`style-src-elem 'self' 'unsafe-inline' 'unsafe-eval';`));
});

test('nginx.conf: NGINX_CSP_* with an empty value is a no-op', async () => {
    const { stdout } = await exec(process.execPath, [SCRIPT], {
        env: {
            ...process.env,
            API_URL: 'https://map.example.com',
            NGINX_CSP_IMG_SRC: '',
        },
    });

    const csp = stdout.match(CSP_REGEX);
    assert.ok(csp, 'Config should contain a Content-Security-Policy header');

    assert.ok(csp[0].includes(`img-src 'self' data: blob: map.example.com:* *.example.com:*;`));
});

test('nginx.conf: unknown NGINX_CSP_* variable is a startup error', async () => {
    await assert.rejects(exec(process.execPath, [SCRIPT], {
        env: {
            ...process.env,
            API_URL: 'https://map.example.com',
            NGINX_CSP_IMGSRC: 'https://tiles.example.com',
        },
    }), (err: Error & { code: number; stderr: string }) => {
        assert.notEqual(err.code, 0);
        assert.match(err.stderr, /Unknown CSP environment variable: NGINX_CSP_IMGSRC/);
        assert.match(err.stderr, /NGINX_CSP_IMG_SRC/);
        return true;
    });
});

test('nginx.conf: NGINX_CSP_* values with nginx-unsafe characters are a startup error', async () => {
    for (const source of ['https://a.com;"', 'https://$host', 'a.com b.com', `x";add_header 'X' 'y`]) {
        await assert.rejects(exec(process.execPath, [SCRIPT], {
            env: {
                ...process.env,
                API_URL: 'https://map.example.com',
                NGINX_CSP_CONNECT_SRC: source,
            },
        }), (err: Error & { code: number; stderr: string }) => {
            assert.notEqual(err.code, 0);
            assert.match(err.stderr, /Invalid CSP source/);
            return true;
        });
    }
});

test('nginx.conf: NGINX_CSP_* is validated but a no-op on localhost', async () => {
    const { stdout } = await exec(process.execPath, [SCRIPT], {
        env: {
            ...process.env,
            API_URL: 'http://localhost:5000',
            NGINX_CSP_IMG_SRC: 'https://tiles.example.com',
        },
    });

    assert.ok(!stdout.includes('Content-Security-Policy'));

    await assert.rejects(exec(process.execPath, [SCRIPT], {
        env: {
            ...process.env,
            API_URL: 'http://localhost:5000',
            NGINX_CSP_IMGSRC: 'https://tiles.example.com',
        },
    }), (err: Error & { code: number; stderr: string }) => {
        assert.notEqual(err.code, 0);
        assert.match(err.stderr, /Unknown CSP environment variable/);
        return true;
    });
});

test('nginx.conf: SPA entrypoints and API proxy', async () => {
    const { stdout } = await exec(process.execPath, [SCRIPT], {
        env: { ...process.env, API_URL: 'https://map.example.com' },
    });

    assert.ok(stdout.includes('try_files /index.html =404;'));
    assert.ok(stdout.includes('try_files /admin.html =404;'));
    assert.ok(stdout.includes('try_files /connection.html =404;'));
    assert.ok(stdout.includes('try_files $uri $uri.html $uri/ /index.html;'));

    assert.ok(stdout.includes(`add_header 'Cache-Control' 'no-store, no-cache, must-revalidate' always;`));
    assert.ok(stdout.includes(`add_header 'Cache-Control' 'public, max-age=31536000, immutable' always;`));

    assert.ok(stdout.includes('location /icons/ {'));
    assert.ok(stdout.includes('autoindex on;'));

    assert.ok(stdout.includes('proxy_pass http://127.0.0.1:5001;'));
    assert.ok(stdout.includes('proxy_read_timeout 600s;'));
    assert.ok(stdout.includes(`proxy_set_header Connection "Upgrade";`));
});

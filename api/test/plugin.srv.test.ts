import test from 'node:test';
import assert from 'node:assert';
import { createHash } from 'node:crypto';
import Stream from 'node:stream';
import zlib from 'node:zlib';
import tar from 'tar-stream';
import Sinon from 'sinon';
import Flight from './flight.js';
import S3 from '../common/aws/s3.js';

const flight = new Flight();

flight.init({ takserver: true });
flight.takeoff();
flight.user();
flight.user({ username: 'user', admin: false });

const objects = new Map<string, Buffer>();
const bundle = Buffer.from('export default { install() { return { enable() {}, disable() {} }; } };');
const sha256 = createHash('sha256').update(bundle).digest('hex');
const logo = `data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>').toString('base64')}`;

function stubS3() {
    Sinon.stub(S3, 'put').callsFake(async (key: string, body: Stream.Readable | string) => {
        if (typeof body === 'string') {
            objects.set(key, Buffer.from(body));
            return;
        }

        const chunks: Buffer[] = [];
        for await (const chunk of body) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }

        objects.set(key, Buffer.concat(chunks));
    });

    Sinon.stub(S3, 'getObject').callsFake(async (key: string) => {
        const body = objects.get(key);
        if (!body) throw new Error(`Missing ${key}`);

        return {
            body: Stream.Readable.from([body]),
            contentLength: body.length,
        };
    });

    Sinon.stub(S3, 'del').callsFake(async (key: string, opts?: { recurse: boolean }) => {
        for (const existing of objects.keys()) {
            if (opts?.recurse ? existing.startsWith(key) : existing === key) objects.delete(existing);
        }
    });
}

type Entry = { name: string; body: string | Buffer; type?: 'file' | 'symlink' | 'directory' };

async function archive(entries: Entry[]): Promise<Buffer> {
    const pack = tar.pack();

    for (const entry of entries) {
        if (entry.type === 'symlink') {
            pack.entry({ name: entry.name, type: 'symlink', linkname: String(entry.body) });
        } else {
            pack.entry({ name: entry.name, type: entry.type ?? 'file' }, entry.body);
        }
    }

    pack.finalize();

    const chunks: Buffer[] = [];
    for await (const chunk of pack.pipe(zlib.createGzip()) as AsyncIterable<Buffer>) chunks.push(chunk);
    return Buffer.concat(chunks);
}

function manifest(overrides: Record<string, unknown> = {}): string {
    return JSON.stringify({
        name: 'Sample',
        version: '1.0.0',
        description: 'Sample Plugin',
        author: 'Sample Author',
        license: 'MIT',
        homepage: 'https://example.com/sample',
        logo,
        sha256,
        api_version: 1,
        ...overrides,
    });
}

function upload(bearer: string, body: Buffer, filename = 'sample.tar.gz') {
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(body)]), filename);

    return flight.fetch('/api/plugin/bundle', {
        method: 'POST',
        auth: { bearer },
        body: form,
    }, false);
}

let id: string;

test('GET: api/plugin - empty', async () => {
    const res = await flight.fetch('/api/plugin', {
        method: 'GET',
        auth: { bearer: flight.token.admin },
    }, true);

    assert.deepEqual(res.body, { total: 0, items: [] });
});

test('POST: api/plugin/bundle - requires admin', async () => {
    const res = await upload(flight.token.user, await archive([
        { name: 'manifest.json', body: manifest() },
        { name: 'index.js', body: bundle },
    ]));

    assert.equal(res.status, 401);
});

test('POST: api/plugin/bundle - rejects invalid bundles', async () => {
    try {
        stubS3();

        const valid = [
            { name: 'manifest.json', body: manifest() },
            { name: 'index.js', body: bundle },
        ];

        const cases: Array<{ body: Buffer; filename?: string; message: string }> = [{
            body: bundle,
            filename: 'index.js',
            message: 'Only .tar.gz bundles can be uploaded',
        },{
            body: bundle,
            message: 'Bundle is not a valid .tar.gz archive',
        },{
            body: await archive([valid[0]]),
            message: 'Bundle is missing index.js',
        },{
            body: await archive([valid[1]]),
            message: 'Bundle is missing manifest.json',
        },{
            body: await archive([...valid, { name: 'extra.js', body: 'x' }]),
            message: 'Unexpected bundle entry: extra.js',
        },{
            body: await archive([valid[0], { name: '../index.js', body: bundle }]),
            message: 'Unexpected bundle entry: ../index.js',
        },{
            body: await archive([valid[0], { name: 'lib/index.js', body: bundle }]),
            message: 'Unexpected bundle entry: lib/index.js',
        },{
            body: await archive([valid[0], { name: 'index.js', body: '/etc/passwd', type: 'symlink' }]),
            message: 'Unexpected bundle entry: index.js',
        },{
            body: await archive([...valid, valid[1]]),
            message: 'Duplicate bundle entry: index.js',
        },{
            body: await archive([{ name: 'manifest.json', body: '{' }, valid[1]]),
            message: 'manifest.json is not valid JSON',
        },{
            body: await archive([{ name: 'manifest.json', body: manifest({ version: '../1.0.0' }) }, valid[1]]),
            message: 'Invalid manifest.json: /version Expected string to match \'^[a-zA-Z0-9][a-zA-Z0-9._+-]*$\'',
        },{
            body: await archive([{ name: 'manifest.json', body: manifest({ name: undefined }) }, valid[1]]),
            message: 'Invalid manifest.json: /name Expected required property',
        },{
            body: await archive([{ name: 'manifest.json', body: manifest({ api_version: 2 }) }, valid[1]]),
            message: 'Plugin requires API version 2 but this server supports 1',
        },{
            body: await archive([{ name: 'manifest.json', body: manifest({ sha256: undefined }) }, valid[1]]),
            message: 'Invalid manifest.json: /sha256 Expected required property',
        },{
            body: await archive([valid[0], { name: 'index.js', body: 'export default {};' }]),
            message: 'index.js does not match the sha256 in manifest.json',
        },{
            body: await archive([{ name: 'manifest.json', body: manifest({ logo: 'https://example.com/logo.png' }) }, valid[1]]),
            message: 'Invalid manifest.json: /logo Expected string to match \'^data:image/(png|jpeg|webp|svg\\+xml);base64,[A-Za-z0-9+/]+=*$\'',
        },{
            body: await archive([{ name: 'manifest.json', body: manifest({ homepage: 'javascript:alert(1)' }) }, valid[1]]),
            message: 'Invalid manifest.json: /homepage Expected string to match \'^https?://\'',
        }];

        for (const c of cases) {
            const res = await upload(flight.token.admin, c.body, c.filename);
            assert.equal(res.status, 400, c.message);
            assert.equal(res.body.message, c.message);
        }

        assert.equal(objects.size, 0);

        const list = await flight.fetch('/api/plugin', {
            method: 'GET',
            auth: { bearer: flight.token.admin },
        }, true);

        assert.equal(list.body.total, 0);
    } finally {
        Sinon.restore();
    }
});

test('POST: api/plugin/bundle - creates plugin', async () => {
    try {
        stubS3();
        const res = await upload(flight.token.admin, await archive([
            { name: './index.js', body: bundle },
            { name: './manifest.json', body: manifest() },
        ]), 'sample.tgz');

        assert.equal(res.status, 200);
        assert.ok(res.body.id);
        assert.equal(res.body.name, 'Sample');
        assert.equal(res.body.description, 'Sample Plugin');
        assert.equal(res.body.author, 'Sample Author');
        assert.equal(res.body.license, 'MIT');
        assert.equal(res.body.homepage, 'https://example.com/sample');
        assert.equal(res.body.logo, logo);
        assert.equal(res.body.enabled, false);
        assert.equal(res.body.api_version, 1);
        assert.equal(res.body.version, '1.0.0');
        assert.equal(res.body.sha256, sha256);
        assert.equal(res.body.size, bundle.length);
        assert.equal(res.body.username, 'admin@example.com');

        id = res.body.id;

        assert.deepEqual([...objects.keys()], [`plugin/${id}/1.0.0/index.js`]);
        assert.deepEqual(objects.get(`plugin/${id}/1.0.0/index.js`), bundle);
    } finally {
        Sinon.restore();
    }
});

test('POST: api/plugin/bundle - same version rejected', async () => {
    try {
        stubS3();
        const res = await upload(flight.token.admin, await archive([
            { name: 'manifest.json', body: manifest() },
            { name: 'index.js', body: bundle },
        ]));

        assert.equal(res.status, 400);
        assert.equal(res.body.message, 'Sample 1.0.0 has already been uploaded');
        assert.equal(objects.size, 1);
    } finally {
        Sinon.restore();
    }
});

test('GET: api/plugin - disabled hidden from users', async () => {
    const res = await flight.fetch('/api/plugin', {
        method: 'GET',
        auth: { bearer: flight.token.user },
    }, true);

    assert.equal(res.body.total, 0);

    const single = await flight.fetch(`/api/plugin/${id}`, {
        method: 'GET',
        auth: { bearer: flight.token.user },
    }, false);

    assert.equal(single.status, 404);

    const raw = await flight.fetch(`/api/plugin/${id}/bundle`, {
        method: 'GET',
        auth: { bearer: flight.token.user },
    }, false);

    assert.equal(raw.status, 404);
});

test('PATCH: api/plugin/:plugin - enable', async () => {
    const res = await flight.fetch(`/api/plugin/${id}`, {
        method: 'PATCH',
        auth: { bearer: flight.token.admin },
        body: { enabled: true },
    }, true);

    assert.equal(res.body.enabled, true);
    assert.equal(res.body.name, 'Sample');
});

test('GET: api/plugin - enabled visible to users', async () => {
    const res = await flight.fetch('/api/plugin', {
        method: 'GET',
        auth: { bearer: flight.token.user },
    }, true);

    assert.equal(res.body.total, 1);
    assert.equal(res.body.items[0].id, id);
    assert.equal(res.body.items[0].sha256, sha256);

    const disabled = await flight.fetch('/api/plugin?enabled=false', {
        method: 'GET',
        auth: { bearer: flight.token.user },
    }, true);

    assert.equal(disabled.body.total, 1, 'users cannot ask for disabled plugins');

    const admin = await flight.fetch('/api/plugin?enabled=false', {
        method: 'GET',
        auth: { bearer: flight.token.admin },
    }, true);

    assert.equal(admin.body.total, 0);
});

test('GET: api/plugin/:plugin/bundle', async () => {
    try {
        stubS3();

        const res = await flight.fetch(`/api/plugin/${id}/bundle?token=${flight.token.user}&sha256=${sha256}`, {
            method: 'GET',
        }, { json: false });

        assert.equal(res.status, 200);
        assert.equal(res.body, bundle.toString());
        assert.equal(res.headers.get('content-type'), 'text/javascript; charset=utf-8');
        assert.equal(res.headers.get('etag'), `"${sha256}"`);
        assert.equal(res.headers.get('cache-control'), 'private, max-age=31536000, immutable');

        const revalidate = await flight.fetch(`/api/plugin/${id}/bundle`, {
            method: 'GET',
            auth: { bearer: flight.token.user },
            headers: { 'If-None-Match': `"${sha256}"` },
        }, { json: false });

        assert.equal(revalidate.status, 304);
        assert.equal(revalidate.headers.get('cache-control'), 'private, no-cache');

        const stale = await flight.fetch(`/api/plugin/${id}/bundle?sha256=abc`, {
            method: 'GET',
            auth: { bearer: flight.token.user },
        }, false);

        assert.equal(stale.status, 404);

        const anon = await flight.fetch(`/api/plugin/${id}/bundle`, {
            method: 'GET',
        }, false);

        assert.equal(anon.status, 401);
    } finally {
        Sinon.restore();
    }
});

test('POST: api/plugin/bundle - new version replaces old', async () => {
    try {
        stubS3();
        const next = Buffer.from('export default {};');
        const res = await upload(flight.token.admin, await archive([
            { name: 'manifest.json', body: manifest({
                version: '1.1.0',
                description: 'Updated',
                author: undefined,
                logo: undefined,
                sha256: createHash('sha256').update(next).digest('hex'),
            }) },
            { name: 'index.js', body: next },
        ]));

        assert.equal(res.status, 200);
        assert.equal(res.body.id, id);
        assert.equal(res.body.version, '1.1.0');
        assert.equal(res.body.description, 'Updated');
        assert.equal(res.body.author, '');
        assert.equal(res.body.logo, null);
        assert.equal(res.body.size, next.length);
        assert.equal(res.body.enabled, true);
        assert.deepEqual([...objects.keys()], [`plugin/${id}/1.1.0/index.js`]);

        const list = await flight.fetch('/api/plugin', {
            method: 'GET',
            auth: { bearer: flight.token.admin },
        }, true);

        assert.equal(list.body.total, 1);
    } finally {
        Sinon.restore();
    }
});

test('DELETE: api/plugin/:plugin', async () => {
    try {
        stubS3();

        const denied = await flight.fetch(`/api/plugin/${id}`, {
            method: 'DELETE',
            auth: { bearer: flight.token.user },
        }, false);

        assert.equal(denied.status, 401);

        const res = await flight.fetch(`/api/plugin/${id}`, {
            method: 'DELETE',
            auth: { bearer: flight.token.admin },
        }, true);

        assert.deepEqual(res.body, { status: 200, message: 'Plugin Deleted' });
        assert.equal(objects.size, 0);

        const list = await flight.fetch('/api/plugin', {
            method: 'GET',
            auth: { bearer: flight.token.admin },
        }, true);

        assert.equal(list.body.total, 0);
    } finally {
        Sinon.restore();
    }
});

flight.landing();

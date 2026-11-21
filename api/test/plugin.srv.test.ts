import test from 'node:test';
import assert from 'node:assert';
import { createHash } from 'node:crypto';
import Stream from 'node:stream';
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

function upload(id: string, version: string, bearer: string, body = bundle, filename = 'index.js') {
    const form = new FormData();
    form.append('file', new Blob([body]), filename);

    return flight.fetch(`/api/plugin/${id}/bundle?version=${version}`, {
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

test('POST: api/plugin - requires admin', async () => {
    const res = await flight.fetch('/api/plugin', {
        method: 'POST',
        auth: { bearer: flight.token.user },
        body: { name: 'Sample' },
    }, false);

    assert.equal(res.status, 401);
});

test('POST: api/plugin', async () => {
    const res = await flight.fetch('/api/plugin', {
        method: 'POST',
        auth: { bearer: flight.token.admin },
        body: { name: 'Sample', description: 'Sample Plugin' },
    }, true);

    assert.ok(res.body.id);
    assert.equal(res.body.name, 'Sample');
    assert.equal(res.body.description, 'Sample Plugin');
    assert.equal(res.body.enabled, false);
    assert.equal(res.body.api_version, 1);
    assert.equal(res.body.version, null);
    assert.equal(res.body.sha256, null);
    assert.equal(res.body.size, null);
    assert.equal(res.body.username, 'admin@example.com');

    id = res.body.id;
});

test('PATCH: api/plugin/:plugin - cannot enable without a bundle', async () => {
    const res = await flight.fetch(`/api/plugin/${id}`, {
        method: 'PATCH',
        auth: { bearer: flight.token.admin },
        body: { enabled: true },
    }, false);

    assert.equal(res.status, 400);
    assert.equal(res.body.message, 'A bundle must be uploaded before a Plugin can be enabled');
});

test('GET: api/plugin/:plugin/bundle - no bundle', async () => {
    const res = await flight.fetch(`/api/plugin/${id}/bundle`, {
        method: 'GET',
        auth: { bearer: flight.token.admin },
    }, false);

    assert.equal(res.status, 404);
});

test('POST: api/plugin/:plugin/bundle - requires admin', async () => {
    const res = await upload(id, '1.0.0', flight.token.user);
    assert.equal(res.status, 401);
});

test('POST: api/plugin/:plugin/bundle - rejects non-js', async () => {
    try {
        stubS3();
        const res = await upload(id, '1.0.0', flight.token.admin, bundle, 'index.zip');
        assert.equal(res.status, 400);
        assert.equal(res.body.message, 'Only .js or .mjs bundles can be uploaded');
        assert.equal(objects.size, 0);
    } finally {
        Sinon.restore();
    }
});

test('POST: api/plugin/:plugin/bundle - rejects unsafe version', async () => {
    const res = await upload(id, '..%2F..%2Fpublic', flight.token.admin);
    assert.equal(res.status, 400);
});

test('POST: api/plugin/:plugin/bundle', async () => {
    try {
        stubS3();
        const res = await upload(id, '1.0.0', flight.token.admin);

        assert.equal(res.status, 200);
        assert.equal(res.body.version, '1.0.0');
        assert.equal(res.body.sha256, sha256);
        assert.equal(res.body.size, bundle.length);
        assert.deepEqual([...objects.keys()], [`plugin/${id}/1.0.0/index.js`]);
    } finally {
        Sinon.restore();
    }
});

test('POST: api/plugin/:plugin/bundle - same version rejected', async () => {
    const res = await upload(id, '1.0.0', flight.token.admin);
    assert.equal(res.status, 400);
    assert.equal(res.body.message, 'Version 1.0.0 has already been uploaded');
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
        body: { enabled: true, name: 'Renamed' },
    }, true);

    assert.equal(res.body.enabled, true);
    assert.equal(res.body.name, 'Renamed');
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

test('POST: api/plugin/:plugin/bundle - new version replaces old', async () => {
    try {
        stubS3();
        const next = Buffer.from('export default {};');
        const res = await upload(id, '1.1.0', flight.token.admin, next, 'index.mjs');

        assert.equal(res.status, 200);
        assert.equal(res.body.version, '1.1.0');
        assert.equal(res.body.size, next.length);
        assert.equal(res.body.enabled, true);
        assert.deepEqual([...objects.keys()], [`plugin/${id}/1.1.0/index.js`]);
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

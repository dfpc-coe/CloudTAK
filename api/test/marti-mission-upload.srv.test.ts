process.env.SigningSecret = 'coe-wildland-fire';
import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';
import Sinon from 'sinon';
import { Readable } from 'node:stream';
import S3 from '../common/aws/s3.js';
import stream2buffer from '../stateless/lib/stream.js';
import AttachmentControl from '../stateless/lib/control/attachment.js';
import type { IncomingMessage, ServerResponse } from 'node:http';

const flight = new Flight();

flight.init({ takserver: true });
flight.takeoff();
flight.user();
flight.user({ username: 'other', admin: false });

const missionGuid = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

type Seen = {
    upload?: { url: string; headers: IncomingMessage['headers']; body: string };
    attach?: { hashes: string[] };
};

function mockTAK(seen: Seen) {
    flight.tak.mockMarti.push(async (request: IncomingMessage, response: ServerResponse) => {
        if (!request.method || !request.url) return false;

        if (request.method === 'POST' && request.url.startsWith('/Marti/sync/upload')) {
            seen.upload = {
                url: request.url,
                headers: request.headers,
                body: String(await stream2buffer(request)),
            };

            response.setHeader('Content-Type', 'text/plain');
            response.write(JSON.stringify({
                UID: 'uid-123',
                SubmissionDateTime: new Date().toISOString(),
                Keywords: [],
                MIMEType: 'text/plain',
                SubmissionUser: 'admin',
                PrimaryKey: '1',
                Hash: 'tak-hash',
                CreatorUid: 'admin@example.com',
                Name: 'notes.txt',
            }));
            response.end();
            return true;
        }

        if (request.method === 'PUT' && request.url.startsWith(`/Marti/api/missions/guid/${encodeURIComponent(missionGuid)}/contents`)) {
            seen.attach = JSON.parse(String(await stream2buffer(request)));

            response.setHeader('Content-Type', 'application/json');
            response.write(JSON.stringify({ version: '3', type: 'Mission', data: [] }));
            response.end();
            return true;
        }

        return false;
    });
}

for (const contentType of [
    'text/plain',
    'application/xml',
    'application/json',
    'application/octet-stream',
    'image/png',
]) {
    test(`POST: api/marti/missions/:guid/upload - uploads a ${contentType} file via multipart`, async () => {
        const seen: Seen = {};
        mockTAK(seen);

        try {
            const body = new FormData();
            body.append('file', new Blob(['{"file":"content"}'], { type: contentType }), 'notes.txt');

            const res = await flight.fetch(`/api/marti/missions/${missionGuid}/upload`, {
                method: 'POST',
                auth: {
                    bearer: flight.token.admin,
                },
                headers: {
                    missionauthorization: 'test-mission-token',
                },
                body,
            }, false);

            assert.equal(res.status, 200, JSON.stringify(res.body));

            assert.ok(seen.upload, 'TAK Server Files.upload should be called');
            assert.equal(seen.upload.body, '{"file":"content"}');
            assert.equal(seen.upload.headers['content-length'], '18');

            const url = new URL(seen.upload.url, 'https://localhost');
            assert.equal(url.searchParams.get('name'), 'notes.txt');
            assert.equal(url.searchParams.get('creatorUid'), 'admin@example.com');

            assert.deepEqual(seen.attach, { hashes: ['tak-hash'] });
        } finally {
            Sinon.restore();
            flight.tak.reset();
        }
    });
}

test('POST: api/marti/missions/:guid/upload - name query overrides the form file name', async () => {
    const seen: Seen = {};
    mockTAK(seen);

    try {
        const body = new FormData();
        body.append('file', new Blob(['data']), 'blob');

        const res = await flight.fetch(`/api/marti/missions/${missionGuid}/upload?name=renamed.txt`, {
            method: 'POST',
            auth: {
                bearer: flight.token.admin,
            },
            headers: {
                missionauthorization: 'test-mission-token',
            },
            body,
        }, false);

        assert.equal(res.status, 200, JSON.stringify(res.body));

        assert.ok(seen.upload);
        assert.equal(seen.upload.body, 'data');
        assert.equal(seen.upload.headers['content-length'], '4');
        const url = new URL(seen.upload.url, 'https://localhost');
        assert.equal(url.searchParams.get('name'), 'renamed.txt');
    } finally {
        Sinon.restore();
        flight.tak.reset();
    }
});

test('POST: api/marti/missions/:guid/upload - rejects a non-multipart body', async () => {
    const seen: Seen = {};
    mockTAK(seen);

    try {
        const res = await flight.fetch(`/api/marti/missions/${missionGuid}/upload`, {
            method: 'POST',
            auth: {
                bearer: flight.token.admin,
            },
            headers: {
                'missionauthorization': 'test-mission-token',
                'content-type': 'text/plain',
            },
            body: Buffer.from('raw body'),
        }, false);

        assert.equal(res.status, 400);
        assert.match(res.body.message, /multipart\/form-data/);
        assert.ok(!seen.upload);
    } finally {
        flight.tak.reset();
    }
});

test('POST: api/marti/missions/:guid/upload - responds instead of hanging when the file cannot be staged', async () => {
    const seen: Seen = {};
    mockTAK(seen);
    const stage = Sinon.stub(AttachmentControl.prototype, 'stage').rejects(new Error('ENOSPC: no space left on device'));

    try {
        const body = new FormData();
        body.append('file', new Blob([Buffer.alloc(64 * 1024, 'x')], { type: 'text/plain' }), 'big.txt');

        const res = await flight.fetch(`/api/marti/missions/${missionGuid}/upload`, {
            method: 'POST',
            auth: {
                bearer: flight.token.admin,
            },
            headers: {
                missionauthorization: 'test-mission-token',
            },
            body,
        }, false);

        assert.equal(res.status, 500);
        assert.ok(!seen.upload);
    } finally {
        stage.restore();
        flight.tak.reset();
    }
});

test('POST: api/marti/missions/:guid/upload - rejects a multipart body with no file', async () => {
    const seen: Seen = {};
    mockTAK(seen);

    try {
        const body = new FormData();
        body.append('note', 'no file here');

        const res = await flight.fetch(`/api/marti/missions/${missionGuid}/upload`, {
            method: 'POST',
            auth: {
                bearer: flight.token.admin,
            },
            headers: {
                missionauthorization: 'test-mission-token',
            },
            body,
        }, false);

        assert.equal(res.status, 400);
        assert.equal(res.body.message, 'No file uploaded');
        assert.ok(!seen.upload);
    } finally {
        flight.tak.reset();
    }
});

test('PUT: api/marti/missions/:guid/upload - attaches a Profile File', async () => {
    const seen: Seen = {};
    mockTAK(seen);

    const s3GetStub = Sinon.stub(S3, 'get').resolves(Readable.from(['file-content']));

    try {
        const file = await flight.config!.models.ProfileFile.generate({
            username: 'admin@example.com',
            name: 'notes.txt',
            size: 12,
        });

        const res = await flight.fetch(`/api/marti/missions/${missionGuid}/upload`, {
            method: 'PUT',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                assets: [{ type: 'profile', id: file.id, name: 'notes.txt' }],
            },
        }, true);

        assert.deepEqual(res.body, { status: 200, message: 'Files Attached' });

        assert.ok(s3GetStub.calledOnce);
        assert.equal(s3GetStub.firstCall.args[0], `profile/admin@example.com/${file.id}.txt`);

        assert.ok(seen.upload, 'TAK Server Files.upload should be called');
        assert.equal(seen.upload.body, 'file-content');
        assert.equal(seen.upload.headers['content-length'], '12');
        assert.deepEqual(seen.attach, { hashes: ['tak-hash'] });
    } finally {
        Sinon.restore();
        flight.tak.reset();
    }
});

test('PUT: api/marti/missions/:guid/upload - rejects another user\'s Profile File', async () => {
    try {
        const file = await flight.config!.models.ProfileFile.generate({
            username: 'admin@example.com',
            name: 'notes.txt',
            size: 12,
        });

        const res = await flight.fetch(`/api/marti/missions/${missionGuid}/upload`, {
            method: 'PUT',
            auth: {
                bearer: flight.token.other,
            },
            body: {
                assets: [{ type: 'profile', id: file.id }],
            },
        }, false);

        assert.equal(res.status, 400);
        assert.equal(res.body.message, 'You can only attach your own files');
    } finally {
        flight.tak.reset();
    }
});

flight.landing();

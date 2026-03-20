import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';
import S3 from '../lib/aws/s3.js';
import Sinon from 'sinon';
import Stream from 'node:stream';

const flight = new Flight();

flight.init({ takserver: true });
flight.takeoff();
flight.user();
flight.user({ username: 'user', admin: false });

test('POST: api/server/tileset', async () => {
    try {
        let uploadedKey = '';
        let uploadedBody = Buffer.alloc(0);

        Sinon.stub(S3, 'put').callsFake(async (key: string, body: Stream.Readable | string) => {
            uploadedKey = key;

            if (typeof body === 'string') {
                uploadedBody = Buffer.from(body);
                return;
            }

            const chunks: Buffer[] = [];
            for await (const chunk of body) {
                chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
            }

            uploadedBody = Buffer.concat(chunks);
        });

        const form = new FormData();
        form.append('file', new Blob([Buffer.from('pmtiles-test')]), 'ski-areas.pmtiles');

        const res = await flight.fetch('/api/server/tileset', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin
            },
            body: form,
        }, false);

        assert.equal(res.status, 200);
        assert.equal(uploadedKey, 'public/ski-areas.pmtiles');
        assert.equal(uploadedBody.toString(), 'pmtiles-test');
        assert.deepEqual(res.body, {
            status: 200,
            message: 'Hosted Tileset Uploaded',
            name: 'ski-areas.pmtiles',
            path: 'public/ski-areas.pmtiles'
        });
    } catch (err) {
        assert.ifError(err);
    } finally {
        Sinon.restore();
    }
});

test('POST: api/server/tileset - Requires Admin', async () => {
    try {
        const form = new FormData();
        form.append('file', new Blob([Buffer.from('pmtiles-test')]), 'ski-areas.pmtiles');

        const res = await flight.fetch('/api/server/tileset', {
            method: 'POST',
            auth: {
                bearer: flight.token.user
            },
            body: form,
        }, false);

        assert.equal(res.status, 401);
        assert.deepEqual(res.body, {
            status: 401,
            message: 'User must be a System Administrator to access this resource',
            messages: []
        });
    } catch (err) {
        assert.ifError(err);
    }
});

flight.landing();

import test from 'node:test';
import assert from 'node:assert';
import Worker from '../src/worker.js';
import fs from 'node:fs';
import Sinon from 'sinon';
import {
    S3Client,
    GetObjectCommand,
} from '@aws-sdk/client-s3';
import { MockAgent, setGlobalDispatcher, getGlobalDispatcher } from 'undici';

test(`Worker Basemap Import: USGS.xml`, async (t) => {
    const mockAgent = new MockAgent();
    const originalDispatcher = getGlobalDispatcher();

    mockAgent.disableNetConnect();

    setGlobalDispatcher(mockAgent);

    t.after(() => {
        Sinon.restore();
        setGlobalDispatcher(originalDispatcher);
        mockAgent.close();
    });

    const mockPool = mockAgent.get('http://localhost:5001');

    mockPool.intercept({
        path: '/api/basemap',
        method: 'POST'
    }).reply((req) => {
        const body = JSON.parse(req.body as string);
        assert.deepEqual(body, {
            name: 'USGS',
            url: 'https://basemap.nationalmap.gov/ArcGIS/rest/services/USGSTopo/MapServer/tile/{$z}/{$y}/{$x}',
            minzoom: 0,
            maxzoom: 15,
            format: 'png'
        });
        
        return {
            statusCode: 200,
            data: JSON.stringify({
                name: 'USGS.xml'
            })
        };
    });

    const logStub = Sinon.stub(console, 'log');
    logStub.callThrough();

    const warnStub = Sinon.stub(console, 'warn');
    warnStub.callThrough();

    const errorStub = Sinon.stub(console, 'error');
    errorStub.callThrough();

    // Mock S3 GetObject
    Sinon.stub(S3Client.prototype, 'send').callsFake((command) => {
        if (command instanceof GetObjectCommand) {
            assert.deepEqual(command.input, {
                Bucket: 'test-bucket',
                Key: `import/ba58a298-a3fe-46b4-a29a-9dd33fbb2139.xml`
            });

            return Promise.resolve({
                Body: fs.createReadStream(new URL(`./fixtures/basemaps/USGS.xml`, import.meta.url))
            });
        }
        return Promise.resolve({});
    });

    const worker = new Worker({
        api: 'http://localhost:5001',
        secret: 'coe-wildland-fire',
        bucket: 'test-bucket',
        job: {
            id: 'ba58a298-a3fe-46b4-a29a-9dd33fbb2139',
            created: '2025-08-25T18:08:21.563Z',
            updated: '2025-08-25T18:08:21.563Z',
            status: 'Running',
            error: null,
            result: {},
            name: `USGS.xml`,
            username: 'admin@example.com',
            source: 'Upload',
            config: {},
            source_id: null,
        }
    });

    await new Promise((resolve, reject) => {
        worker.on('error', (err) => {
            reject(err);
        });

        worker.on('success', () => {
            resolve(true);
        });

        worker.process();
    });
});

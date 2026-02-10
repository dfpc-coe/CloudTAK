import test from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import Worker from '../src/worker.js';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import Sinon from 'sinon';
import {
    S3Client,
    GetObjectCommand,
} from '@aws-sdk/client-s3';
import { MockAgent, setGlobalDispatcher, getGlobalDispatcher } from 'undici';

test(`Worker Iconset Import: OSM.zip`, async (t) => {
    const fixturename = 'OSM.zip';
    const ext = path.extname(fixturename);
    const mockAgent = new MockAgent();
    const originalDispatcher = getGlobalDispatcher();

    const expectedIcons = [{
        "name": "General/accommodation.png",
        "path": "6d781afb-89a6-4c07-b2b9-a89748b6a38f/General/accommodation.png"
    },{
        "name": "General/education.png",
        "path": "6d781afb-89a6-4c07-b2b9-a89748b6a38f/General/education.png"
    },{
        "name": "General/empty.png",
        "path": "6d781afb-89a6-4c07-b2b9-a89748b6a38f/General/empty.png"
    },{
        "name": "General/food.png",
        "path": "6d781afb-89a6-4c07-b2b9-a89748b6a38f/General/food.png"
    },{
        "name": "General/geocache.png",
        "path": "6d781afb-89a6-4c07-b2b9-a89748b6a38f/General/geocache.png"
    }];

    const icons: Array<{
        name: string;
        path: string;
    }> = [];

    mockAgent.disableNetConnect();

    setGlobalDispatcher(mockAgent);

    t.after(() => {
        Sinon.restore();
        setGlobalDispatcher(originalDispatcher);
        mockAgent.close();
    });

    const mockPool = mockAgent.get('http://localhost:5001');

    mockPool.intercept({
        path: /\/api\/iconset\/.*/,
        method: 'GET'
    }).reply(() => {
        return {
            statusCode: 404,
            data: JSON.stringify({})
        };
    });

    mockPool.intercept({
        path: '/api/iconset',
        method: 'POST'
    }).reply((req) => {
        const body = JSON.parse(req.body);

        assert.ok(body.uid);
        assert.ok(body.version);
        assert.ok(body.name);
        assert.ok(body.skip_resize !== undefined);

        return {
            statusCode: 200,
            data: JSON.stringify({})
        };
    });

    mockPool.intercept({
        path: /\/api\/iconset\/.*\/icon/,
        method: 'POST'
    }).reply((req) => {
        const body = JSON.parse(req.body);

        assert.ok(body.name);
        assert.ok(body.path);
        assert.ok(body.data);

        icons.push({
            name: body.name,
            path: body.path
        });

        return {
            statusCode: 200,
            data: JSON.stringify({})
        };
    }).persist();

    mockPool.intercept({
        path: /\/api\/import\/.*\/result/,
        method: 'POST'
    }).reply((req) => {
        return {
            statusCode: 200,
            data: JSON.stringify({})
        };
    }).persist();

    const ExternalOperations = [
        (command) => {
            assert.ok(command instanceof GetObjectCommand);
            assert.deepEqual(command.input, {
                Bucket: 'test-bucket',
                Key: `import/ba58a298-a3fe-46b4-a29a-9dd33fbb2139${ext}`
            });

            return Promise.resolve({
                Body: fs.createReadStream(new URL(`./fixtures/iconsets/${fixturename}`, import.meta.url))
            })
        },
    ].reverse();

    const logStub = Sinon.stub(console, 'log');
    logStub.callThrough();
    logStub.withArgs(Sinon.match(/is not a Basemap/)).returns();

    const warnStub = Sinon.stub(console, 'warn');
    warnStub.callThrough();
    warnStub.withArgs(Sinon.match(/must have required property 'customMapSource'/)).returns();

    Sinon.stub(S3Client.prototype, 'send').callsFake((command) => {
        return ExternalOperations.pop()(command);
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
            name: fixturename,
            username: 'admin@example.com',
            source: 'Upload',
            config: {},
            source_id: null,
        }
    });

    worker.on('error', (err) => {
        assert.ifError(err);
    });

    worker.on('success', () => {
        assert.ok(icons.length > 0, 'No icons were imported');

        icons.sort((a, b) => a.name.localeCompare(b.name));

        assert.deepEqual(icons.slice(0, expectedIcons.length), expectedIcons, 'Imported icons do not match expected icons');
    });

    await worker.process()
});

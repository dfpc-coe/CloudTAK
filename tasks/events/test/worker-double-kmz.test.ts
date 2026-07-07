import test from 'node:test';
import assert from 'node:assert';
import Worker from '../src/worker.js';
import fs from 'node:fs';
import path from 'node:path';
import Sinon from 'sinon';
import {
    S3Client,
    GetObjectCommand,
    PutObjectCommand,
    CreateMultipartUploadCommand,
    UploadPartCommand,
    CompleteMultipartUploadCommand,
} from '@aws-sdk/client-s3';
import { MockAgent, setGlobalDispatcher, getGlobalDispatcher } from 'undici';

test(`Worker DataPackage Import: Packaged File`, async (t) => {
    const assets: Array<{ id: string; name: string }> = [];
    const patches: Array<Array<{ ext: string }>> = [];
    const basemaps: Array<Record<string, unknown>> = [];
    const uploads: Array<string> = [];

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
        path: '/api/iconset',
        method: 'POST',
    }).reply(() => {
        assert.ok(true, 'Creating Iconset');
        return {
            statusCode: 200,
            data: JSON.stringify({}),
        };
    }).persist();

    mockPool.intercept({
        path: /\/api\/iconset\/.*\/icon/,
        method: 'POST',
    }).reply(() => {
        assert.ok(true, 'Uploading Icon');
        return {
            statusCode: 200,
            data: JSON.stringify({}),
        };
    }).persist();

    mockPool.intercept({
        path: /\/api\/iconset\/.*\/regen/,
        method: 'POST',
    }).reply(() => {
        assert.ok(true, 'Regenerating Iconset');
        return {
            statusCode: 200,
            data: JSON.stringify({}),
        };
    }).persist();

    mockPool.intercept({
        path: /api\/import\/.*\/result$/,
        method: 'POST',
    }).reply(200, JSON.stringify({})).persist();

    mockPool.intercept({
        path: /api\/config\/tiles$/,
        method: 'GET',
    }).reply(200, JSON.stringify({
        url: 'http://localhost:5002',
    })).persist();

    mockPool.intercept({
        path: /api\/basemap$/,
        method: 'POST',
    }).reply((req) => {
        const body = JSON.parse(req.body) as Record<string, unknown>;

        basemaps.push(body);

        return {
            statusCode: 200,
            data: JSON.stringify({
                id: 100 + basemaps.length,
                name: body.name,
            }),
        };
    }).persist();

    mockPool.intercept({
        path: /profile\/asset$/,
        method: 'POST',
    }).reply((req) => {
        const body = JSON.parse(req.body) as {
            id: string;
            name: string;
        };

        assets.push({ id: body.id, name: body.name });

        return {
            statusCode: 200,
            data: JSON.stringify({
                id: body.id,
                artifacts: [],
            }),
        };
    }).persist();

    mockPool.intercept({
        path: /profile\/asset\//,
        method: 'PATCH',
    }).reply((req) => {
        const body = JSON.parse(req.body) as {
            iconset?: string;
            artifacts?: Array<{ ext: string }>;
        };

        if (body.artifacts) patches.push(body.artifacts);

        return {
            statusCode: 200,
            data: JSON.stringify({
                id: assets.length ? assets[assets.length - 1].id : '',
                artifacts: body.artifacts || [],
            }),
        };
    }).persist();

    Sinon.stub(S3Client.prototype, 'send').callsFake(async (command) => {
        if (command instanceof UploadPartCommand) {
            return { ETag: '"123"' };
        }
        if (command instanceof CompleteMultipartUploadCommand) {
            return { Location: '...' };
        }

        if (command instanceof GetObjectCommand) {
            assert.deepEqual(command.input, {
                Bucket: 'test-bucket',
                Key: `import/ba58a298-a3fe-46b4-a29a-9dd33fbb2139.zip`,
            });

            return {
                Body: fs.createReadStream(new URL(`./fixtures/package/DP-KMZDouble.zip`, import.meta.url)),
            };
        }

        assert.ok(
            command instanceof PutObjectCommand || command instanceof CreateMultipartUploadCommand,
            `Unexpected command: ${command.constructor.name}`,
        );
        assert.equal(command.input.Bucket, 'test-bucket');
        assert.ok(String(command.input.Key).startsWith(`profile/admin@example.com/`));

        // Multipart uploads issue CreateMultipartUpload once per file
        if (command instanceof CreateMultipartUploadCommand) {
            uploads.push(path.parse(String(command.input.Key)).ext);
            return { UploadId: '123' };
        }

        uploads.push(path.parse(String(command.input.Key)).ext);
        return { ETag: '"123"' };
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
            name: `import.zip`,
            username: 'admin@example.com',
            source: 'Upload',
            config: {},
            source_id: null,
        },
    });

    worker.on('error', (err) => {
        assert.ifError(err);
    });

    worker.on('success', () => {
    });

    await worker.process();

    const names = assets.map(a => a.name).sort();
    assert.deepEqual(names, [
        'Base-FAB.kmz',
        'GRG_20250712T131521.jpg.tif',
        'Mapa Base FAB.kmz',
    ]);

    // Base-FAB.kmz: vector features -> .geojsonld + .pmtiles
    // Mapa Base FAB.kmz: GroundOverlay only -> .geojsonld (empty), no vector tiles
    // GroundOverlay child asset: .pmtiles only
    const sortedPatches = patches.map(p => p.map(a => a.ext).join(',')).sort();
    assert.deepEqual(sortedPatches, [
        '.geojsonld',
        '.geojsonld',
        '.geojsonld,.pmtiles',
        '.pmtiles',
    ]);

    const counts: Record<string, number> = {};
    for (const ext of uploads) counts[ext] = (counts[ext] || 0) + 1;
    assert.deepEqual(counts, {
        '.kmz': 2,
        '.geojsonld': 2,
        '.pmtiles': 2,
        '.tif': 1,
    });

    // The GRG KMZ has no vector features so its single GroundOverlay is
    // created as a standalone Overlay without a parent
    assert.equal(basemaps.length, 1);
    const overlay = basemaps[0];
    assert.equal(overlay.name, 'GRG_20250712T131521.jpg');
    assert.equal(overlay.overlay, true);
    assert.equal(overlay.protocol, 'hosted');
    assert.equal(overlay.type, 'raster');
    assert.equal(overlay.format, 'png');
    assert.equal(overlay.parent, undefined);

    const tifAsset = assets.find(a => a.name === 'GRG_20250712T131521.jpg.tif');
    assert.ok(tifAsset);
    assert.ok(
        String(overlay.url).startsWith(`http://localhost:5002/tiles/profile/admin@example.com/${tifAsset.id}/tiles/{z}/{x}/{y}.png?token=`),
        `Unexpected overlay url: ${overlay.url}`,
    );

    const bounds = overlay.bounds as Array<number>;
    assert.equal(bounds.length, 4);
    assert.ok(Math.abs(bounds[0] - -47.278844197873724) < 1e-9);
    assert.ok(Math.abs(bounds[1] - -22.72714851397172) < 1e-9);
    assert.ok(Math.abs(bounds[2] - -47.26949577274807) < 1e-9);
    assert.ok(Math.abs(bounds[3] - -22.72069833530908) < 1e-9);
});

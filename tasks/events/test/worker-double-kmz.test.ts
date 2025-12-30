import test from 'node:test';
import assert from 'node:assert';
import Worker from '../src/worker.js';
import fs from 'node:fs';
import Sinon from 'sinon';
import {
    S3Client,
    GetObjectCommand,
    PutObjectCommand,
    CreateMultipartUploadCommand,
    UploadPartCommand,
    CompleteMultipartUploadCommand
} from '@aws-sdk/client-s3';
import { MockAgent, setGlobalDispatcher, getGlobalDispatcher } from 'undici';

test(`Worker DataPackage Import: Packaged File`, async (t) => {
    let id: string;

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
        method: 'POST'
    }).reply(() => {
        assert.ok(true, 'Creating Iconset');
        return {
            statusCode: 200,
            data: JSON.stringify({})
        };
    }).persist();

    mockPool.intercept({
        path: /\/api\/iconset\/.*\/icon/,
        method: 'POST'
    }).reply(() => {
        assert.ok(true, 'Uploading Icon');
        return {
            statusCode: 200,
            data: JSON.stringify({})
        };
    }).persist();

    mockPool.intercept({
        path: /\/api\/iconset\/.*\/regen/,
        method: 'POST'
    }).reply(() => {
        assert.ok(true, 'Regenerating Iconset');
        return {
            statusCode: 200,
            data: JSON.stringify({})
        };
    }).persist();

    const expectedNames = new Set(['Base-FAB.kmz', 'Mapa Base FAB.kmz']);

    for (let i = 0; i < 2; i++) {
        mockPool.intercept({
            path: /profile\/asset/,
            method: 'POST'
        }).reply((req) => {
            const body = JSON.parse(req.body) as {
                id: string,
                name: string
            };

            assert.ok(expectedNames.has(body.name), `Name ${body.name} should be in expected list`);
            expectedNames.delete(body.name);

            id = body.id;

            return {
                statusCode: 200,
                data: JSON.stringify({
                    id: body.id,
                    artifacts: []
                })
            };
        });

        mockPool.intercept({
            path: /profile\/asset\//,
            method: 'PATCH',
            body: (str) => !!JSON.parse(str).iconset
        }).reply((req) => {
            const body = JSON.parse(req.body) as {
                iconset: string
            };

            assert.ok(body.iconset);

            return {
                statusCode: 200,
                data: JSON.stringify({
                    id: id,
                    artifacts: []
                })
            };
        });

        mockPool.intercept({
            path: /profile\/asset\//,
            method: 'PATCH'
        }).reply((req) => {
            const body = JSON.parse(req.body) as {
                artifacts: Array<{ ext: string }>
            };

            assert.deepEqual(body, {
                artifacts: [ { ext: '.geojsonld' } ]
            });

            return {
                statusCode: 200,
                data: JSON.stringify({
                    id: id,
                    artifacts: [{
                        ext: '.geojsonld'
                    }]
                })
            };
        });

        mockPool.intercept({
            path: /profile\/asset\//,
            method: 'PATCH'
        }).reply((req) => {
            const body = JSON.parse(req.body) as {
                artifacts: Array<{ ext: string }>
            };

            assert.deepEqual(body, {
                artifacts: [ { ext: '.geojsonld' }, { ext: '.pmtiles' } ]
            });

            return {
                statusCode: 200,
                data: JSON.stringify({
                    id: id,
                    artifacts: [{
                        ext: '.geojsonld'
                    }, {
                        ext: '.pmtiles'
                    }]
                })
            };
        });
    }

    const ExternalOperations = [
            (command) => {
                assert.ok(command instanceof GetObjectCommand);
                assert.deepEqual(command.input, {
                    Bucket: 'test-bucket',
                    Key: `import/ba58a298-a3fe-46b4-a29a-9dd33fbb2139.zip`
                });

                return Promise.resolve({
                    Body: fs.createReadStream(new URL(`./fixtures/package/DP-KMZDouble.zip`, import.meta.url))
                })
            },
            // File 1
            (command) => {
                if (command instanceof CreateMultipartUploadCommand) {
                    assert.equal(command.input.Bucket, 'test-bucket');
                    assert.ok(command.input.Key.startsWith(`profile/admin@example.com/`))
                    assert.ok(command.input.Key.endsWith('.kmz'))
                    return Promise.resolve({ UploadId: '123' });
                }
                assert.ok(command instanceof PutObjectCommand);
                assert.equal(command.input.Bucket, 'test-bucket');
                assert.ok(command.input.Key.startsWith(`profile/admin@example.com/`))
                assert.ok(command.input.Key.endsWith('.kmz'))

                return Promise.resolve({ ETag: '"123"' })
            },
            (command) => {
                if (command instanceof CreateMultipartUploadCommand) {
                    assert.equal(command.input.Bucket, 'test-bucket');
                    assert.ok(command.input.Key.startsWith(`profile/admin@example.com/`))
                    assert.ok(command.input.Key.endsWith('.geojsonld'))
                    return Promise.resolve({ UploadId: '123' });
                }
                assert.ok(command instanceof PutObjectCommand);
                assert.equal(command.input.Bucket, 'test-bucket');
                assert.ok(command.input.Key.startsWith(`profile/admin@example.com/`))
                assert.ok(command.input.Key.endsWith('.geojsonld'))

                return Promise.resolve({ ETag: '"123"' })
            },
            (command) => {
                if (command instanceof CreateMultipartUploadCommand) {
                    assert.equal(command.input.Bucket, 'test-bucket');
                    assert.ok(command.input.Key.startsWith(`profile/admin@example.com/`))
                    assert.ok(command.input.Key.endsWith('.pmtiles'))
                    return Promise.resolve({ UploadId: '123' });
                }
                assert.ok(command instanceof PutObjectCommand);
                assert.equal(command.input.Bucket, 'test-bucket');
                assert.ok(command.input.Key.startsWith(`profile/admin@example.com/`))
                assert.ok(command.input.Key.endsWith('.pmtiles'))

                return Promise.resolve({ ETag: '"123"' })
            },
            // File 2
            (command) => {
                if (command instanceof CreateMultipartUploadCommand) {
                    assert.equal(command.input.Bucket, 'test-bucket');
                    assert.ok(command.input.Key.startsWith(`profile/admin@example.com/`))
                    assert.ok(command.input.Key.endsWith('.kmz'))
                    return Promise.resolve({ UploadId: '123' });
                }
                assert.ok(command instanceof PutObjectCommand);
                assert.equal(command.input.Bucket, 'test-bucket');
                assert.ok(command.input.Key.startsWith(`profile/admin@example.com/`))
                assert.ok(command.input.Key.endsWith('.kmz'))

                return Promise.resolve({ ETag: '"123"' })
            },
            (command) => {
                if (command instanceof CreateMultipartUploadCommand) {
                    assert.equal(command.input.Bucket, 'test-bucket');
                    assert.ok(command.input.Key.startsWith(`profile/admin@example.com/`))
                    assert.ok(command.input.Key.endsWith('.geojsonld'))
                    return Promise.resolve({ UploadId: '123' });
                }
                assert.ok(command instanceof PutObjectCommand);
                assert.equal(command.input.Bucket, 'test-bucket');
                assert.ok(command.input.Key.startsWith(`profile/admin@example.com/`))
                assert.ok(command.input.Key.endsWith('.geojsonld'))

                return Promise.resolve({ ETag: '"123"' })
            },
            (command) => {
                if (command instanceof CreateMultipartUploadCommand) {
                    assert.equal(command.input.Bucket, 'test-bucket');
                    assert.ok(command.input.Key.startsWith(`profile/admin@example.com/`))
                    assert.ok(command.input.Key.endsWith('.pmtiles'))
                    return Promise.resolve({ UploadId: '123' });
                }
                assert.ok(command instanceof PutObjectCommand);
                assert.equal(command.input.Bucket, 'test-bucket');
                assert.ok(command.input.Key.startsWith(`profile/admin@example.com/`))
                assert.ok(command.input.Key.endsWith('.pmtiles'))

                return Promise.resolve({ ETag: '"123"' })
            },
    ].reverse();

    Sinon.stub(S3Client.prototype, 'send').callsFake(async (command) => {
        if (command instanceof UploadPartCommand) {
             return { ETag: '"123"' };
        }
        if (command instanceof CompleteMultipartUploadCommand) {
             return { Location: '...' };
        }

        const validator = ExternalOperations.pop();
        if (!validator) throw new Error(`Unexpected command: ${command.constructor.name}`);
        
        return validator(command);
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
        }
    });

    worker.on('error', (err) => {
        assert.ifError(err);
    });

    worker.on('success', () => {
    });

    await worker.process()
});

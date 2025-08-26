import test from 'tape';
import path from 'node:path';
import Worker from '../src/worker.js';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import Sinon from 'sinon';
import {
    S3Client,
    GetObjectCommand,
    PutObjectCommand,
    CopyObjectCommand
} from '@aws-sdk/client-s3';

for (const fixturename of await fsp.readdir(new URL('./fixtures/transform/', import.meta.url))) {
    const { ext } = path.parse(fixturename);

    test(`Worker Data Transform: ${fixturename}`, async (t) => {
        const ExternalOperations = [
                (command) => {
                    t.ok(command instanceof GetObjectCommand);
                    t.deepEquals(command.input, {
                        Bucket: 'test-bucket',
                        Key: `import/ba58a298-a3fe-46b4-a29a-9dd33fbb2139${ext}`
                    });

                    return Promise.resolve({
                        Body: fs.createReadStream(new URL(`./fixtures/transform/${fixturename}`, import.meta.url))
                    })
                },
                (command) => {
                    t.ok(command instanceof CopyObjectCommand);
                    t.deepEquals(command.input, {
                        CopySource: `test-bucket/import/ba58a298-a3fe-46b4-a29a-9dd33fbb2139${ext}`,
                        Bucket: 'test-bucket',
                        Key: `profile/admin@example.com/ba58a298-a3fe-46b4-a29a-9dd33fbb2139${ext}`
                    });

                    return Promise.resolve({});
                },
                (command) => {
                    t.ok(command instanceof PutObjectCommand);

                    t.equals(command.input.Bucket, 'test-bucket')
                    t.equals(command.input.Key, 'profile/admin@example.com/ba58a298-a3fe-46b4-a29a-9dd33fbb2139.geojsonld');

                    return Promise.resolve({});
                },
                (command) => {
                    t.ok(command instanceof PutObjectCommand);

                    t.equals(command.input.Bucket, 'test-bucket')
                    t.equals(command.input.Key, 'profile/admin@example.com/ba58a298-a3fe-46b4-a29a-9dd33fbb2139.pmtiles');

                    return Promise.resolve({});
                },
        ].reverse();

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
                name: `import${ext}`,
                username: 'admin@example.com',
                source: 'Upload',
                config: {},
                source_id: null,
            }
        });

        worker.on('error', (err) => {
            t.error(err);
        });

        worker.on('success', () => {
            Sinon.restore();
            t.end()
        });

        await worker.process()
    });
}

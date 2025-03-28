import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import test from 'tape';
import Task from '../task.js';
import { fileURLToPath } from 'node:url';
import Sinon from 'sinon';
import {
    S3Client,
    PutObjectCommand,
    GetObjectCommand
} from '@aws-sdk/client-s3';

process.env.TAK_ETL_URL = 'https://example.cotak.gov';
process.env.TAK_ETL_BUCKET = 'example-bucket';
process.env.ETL_ID = 'nicholas.ingalls@state.co.us';
process.env.ETL_TYPE = 'profile';
process.env.ETL_TOKEN = 'token-123';

for (const fixturename of await fsp.readdir(new URL('./fixtures/', import.meta.url))) {
    test(`Fixture Tests: ${fixturename}`, async (t) => {
        process.env.ETL_TASK = JSON.stringify({
            asset: fixturename
        });

        const task = new Task();

        const { name } = path.parse(fixturename);

        Sinon.stub(S3Client.prototype, 'send').callsFake((command) => {
            if (command instanceof GetObjectCommand) {
                t.deepEquals(command.input, {
                    Bucket: 'example-bucket',
                    Key: `profile/nicholas.ingalls@state.co.us/${fixturename}`
                });

                return {
                    Body: fs.createReadStream(new URL(`./fixtures/${fixturename}`, import.meta.url))
                };
            } else if (command instanceof PutObjectCommand && command.input.Key.endsWith('.pmtiles')) {
                const body = command.input.Body;
                delete command.input.Body;

                t.deepEquals(command.input, {
                    Bucket: 'example-bucket',
                    Key: `profile/nicholas.ingalls@state.co.us/${name}.pmtiles`
                });
            } else if (command instanceof PutObjectCommand && command.input.Key.endsWith('.geojsonld')) {
                const body = command.input.Body;
                delete command.input.Body;

                t.deepEquals(command.input, {
                    Bucket: 'example-bucket',
                    Key: `profile/nicholas.ingalls@state.co.us/${name}.geojsonld`
                });

                const feats = String(body).split('\n')
                    .map(JSON.parse)

                t.ok(feats.length > 0);

                feats.forEach((f) => {
                    t.equals(f.type, 'Feature')
                });
            } else {
                test.fail('Unexpected Command');
            }
        });

        try {
            await task.control();

            await task.reporter();
        } catch (err) {
            t.error(err);
        }

        Sinon.restore();

        t.end();
    });
}

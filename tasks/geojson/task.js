import fs from 'node:fs';
import KML from './lib/kml.js';
import S3 from '@aws-sdk/client-s3';
import { pipeline } from 'node:stream/promises';
import jwt from 'jsonwebtoken';
import path from 'node:path';
import os from 'node:os';

try {
    const dotfile = new URL('.env', import.meta.url);

    fs.accessSync(dotfile);

    Object.assign(process.env, JSON.parse(fs.readFileSync(dotfile)));
    console.log('ok - .env file loaded');
} catch (err) {
    console.log('ok - no .env file loaded');
}

export default class Task {
    constructor() {
        this.etl = {
            api: process.env.ETL_API || '',
            data: process.env.ETL_DATA || '',
            bucket: process.env.ETL_BUCKET || '',
            token: process.env.ETL_TOKEN || '',
            task: process.env.ETL_TASK || '{}'
        };

        // This is just a helper function for local development, signing with the (unsecure) default secret
        if (!this.etl.token && (new URL(this.etl.api)).hostname === 'localhost') {
            this.etl.token = jwt.sign({ access: 'data', data: parseInt(this.etl.data) }, 'coe-wildland-fire');
        }

        if (!this.etl.api) throw new Error('No ETL API URL Provided');
        if (!this.etl.data) throw new Error('No ETL Data Provided');
        if (!this.etl.token) throw new Error('No ETL Token Provided');
        if (!this.etl.bucket) throw new Error('No ETL Bucket Provided');
        if (!this.etl.task) throw new Error('No ETL Task Provided');

        this.etl.task = JSON.parse(this.etl.task);
    }

    async control() {
        const s3 = new S3.S3Client({ region: process.env.AWS_DEFAULT_REGION });

        console.log(`ok - fetching s3://${this.etl.bucket}/data/${this.etl.data}/${this.etl.task.asset}`);
        const res = await s3.send(new S3.GetObjectCommand({
            Bucket: this.etl.bucket,
            Key: `data/${this.etl.data}/${this.etl.task.asset}`
        }));

        await pipeline(res.Body, fs.createWriteStream(path.resolve(os.tmpdir(), this.etl.task.asset)));

        let stream;
        let asset;
        if (this.etl.task.config.format === 'GeoJSON') {
            const kml = new KML(this.etl);
            stream = await kml.convert();
            asset = path.parse(this.etl.task.asset).name + '.geojsonld';
        }

        await s3.send(new S3.PutObjectCommand({
            Bucket: this.etl.bucket,
            Key: `data/${this.etl.data}/${asset}`,
            Body: stream
        }));
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    const task = new Task();
    task.control();
}

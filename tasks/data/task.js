import os from 'node:os';
import fs from 'node:fs';
import S3 from '@aws-sdk/client-s3';
import { pipeline } from 'node:stream/promises';
import { Upload } from '@aws-sdk/lib-storage';
import Tippecanoe from './lib/tippecanoe.js';
import jwt from 'jsonwebtoken';
import path from 'node:path';
import API from './lib/api.js';
import cp from 'node:child_process';

// Formats
import KML from './lib/kml.js';
import Translate from './lib/translate.js';
import GeoJSON from './lib/geojson.js';

const FORMATS = [KML, Translate, GeoJSON];
const formats = new Map();

// TODO load all conversion files from a directory
for (const format of FORMATS) {
    const config = format.register();
    for (const input of config.inputs) {
        if (formats.has(input)) throw new Error('Input is already defined');
        formats.set(input, format);
    }
}

try {
    const dotfile = new URL('.env', import.meta.url);

    fs.accessSync(dotfile);

    Object.assign(process.env, JSON.parse(fs.readFileSync(dotfile)));
    console.log('ok - .env file loaded');
} catch (err) {
    console.log(`ok - no .env file loaded: ${err}`);
}

export default class Task {
    constructor() {
        if (!process.env.AWS_REGION) process.env.AWS_REGION = 'us-east-1';

        this.temp = fs.mkdtempSync(path.resolve(os.tmpdir(), 'cloudtak-'));

        this.etl = {
            api: process.env.TAK_ETL_URL || '',
            bucket: process.env.TAK_ETL_BUCKET || '',
            id: process.env.ETL_ID || '',
            type: process.env.ETL_TYPE || '',
            token: process.env.ETL_TOKEN || '',
            task: process.env.ETL_TASK || '{}'
        };

        if (!this.etl.api) throw new Error('No ETL API URL Provided');
        if (!this.etl.type) throw new Error('No ETL Type Provided');
        if (!this.etl.id) throw new Error('No ETL ID Provided');
        if (!this.etl.token) throw new Error('No ETL Token Provided');
        if (!this.etl.bucket) throw new Error('No ETL Bucket Provided');
        if (!this.etl.task) throw new Error('No ETL Task Provided');

        // This is just a helper function for local development, signing with the (unsecure) default secret
        if (!this.etl.token && (new URL(this.etl.api)).hostname === 'localhost') {
            const jwtPayload = { access: this.etl.type };
            jwtPayload[this.etl.type] = this.etl.id;
            this.etl.token = jwt.sign({ access: this.etl.type }, 'coe-wildland-fire');
        }

        this.etl.task = JSON.parse(this.etl.task);

        if (!this.etl.task.asset) throw new Error('.task.asset Not Provided');
    }

    async control() {
        const s3 = new S3.S3Client({ region: process.env.AWS_DEFAULT_REGION });

        console.log(`ok - fetching s3://${this.etl.bucket}/${this.etl.type}/${this.etl.id}/${this.etl.task.asset}`);
        const res = await s3.send(new S3.GetObjectCommand({
            Bucket: this.etl.bucket,
            Key: `${this.etl.type}/${this.etl.id}/${this.etl.task.asset}`
        }));

        await pipeline(res.Body, fs.createWriteStream(path.resolve(this.temp, this.etl.task.asset)));

        const { ext } = path.parse(this.etl.task.asset);
        if (!formats.has(ext)) throw new Error('Unsupported Input Format');
        const convert = new (formats.get(ext))(this);

        const asset = await convert.convert();

        if (path.parse(asset).ext === '.geojsonld') {
            const geouploader = new Upload({
                client: s3,
                params: {
                    Bucket: this.etl.bucket,
                    Key: `${this.etl.type}/${this.etl.id}/${path.parse(this.etl.task.asset).name}.geojsonld`,
                    Body: fs.createReadStream(asset)
                }
            });
            await geouploader.done();

            const tp = new Tippecanoe();

            console.log(`ok - tiling ${asset}`);
            await tp.tile(
                fs.createReadStream(asset),
                path.resolve(this.temp, path.parse(this.etl.task.asset).name + '.pmtiles'), {
                    std: true,
                    quiet: false,
                    name: asset,
                    description: 'Automatically Converted by @tak-ps/etl',
                    layer: 'out',
                    force: true,
                    limit: {
                        features: false,
                        size: false
                    },
                    zoom: {
                        min: 0,
                        max: 14
                    }
                }
            );

            const pmuploader = new Upload({
                client: s3,
                params: {
                    Bucket: this.etl.bucket,
                    Key: `${this.etl.type}/${this.etl.id}/${path.parse(this.etl.task.asset).name}.pmtiles`,
                    Body: fs.createReadStream(path.resolve(this.temp, path.parse(this.etl.task.asset).name + '.pmtiles'))
                }
            });
            await pmuploader.done();
        } else {
            console.log(`ok - converting ${asset}`);
            const pmout = cp.execSync(`pmtiles convert ${asset} ${path.resolve(this.temp, path.parse(this.etl.task.asset).name + '.pmtiles')}`);
            console.log(String(pmout));

            console.log(`ok - converted: ${path.resolve(this.temp, path.parse(this.etl.task.asset).name + '.pmtiles')}`);

            const pmuploader = new Upload({
                client: s3,
                params: {
                    Bucket: this.etl.bucket,
                    Key: `${this.etl.type}/${this.etl.id}/${path.parse(this.etl.task.asset).name}.pmtiles`,
                    Body: fs.createReadStream(path.resolve(this.temp, path.parse(this.etl.task.asset).name + '.pmtiles'))
                }
            });

            await pmuploader.done();
        }
    }

    async reporter(err) {
        if (err) console.error(err);

        if (this.etl.task.import) {
            if (err) {
                console.error('Import Detected - reporting failure');

                await API.updateImport(this.etl.task.import, this.etl.token, {
                    status: 'Fail',
                    error: err.message
                });
            } else {
                await API.updateImport(this.etl.task.import, this.etl.token, {
                    status: 'Success',
                    result: {}
                });
            }
        }
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    const task = new Task();

    try {
        await task.control();
        await task.reporter();
    } catch (err) {
        await task.reporter(err instanceof Error ? err : new Error(String(err)));
    }
}

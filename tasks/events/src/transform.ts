import fs from 'node:fs';
import type { Message, LocalMessage } from './types.ts';
import S3 from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import path from 'node:path';
import cp from 'node:child_process';

import API from './api.ts';
import Tippecanoe from './transforms/tippecanoe.ts';

// Formats
import KML from './transforms/kml.ts';
import Translate from './transforms/translate.ts';
import GeoJSON from './transforms/geojson.ts';

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

export default class DataTransform {
    msg: Message;
    local: LocalMessage;

    constructor(
        msg: Message,
        local: LocalMessage
    ) {
        this.msg = msg;
        this.local = local;
    }

    async run() {
        const s3 = new S3.S3Client({ region: process.env.AWS_REGION || 'us-east-1' });

        if (!formats.has(this.local.ext)) {
            throw new Error('Unsupported Input Format');
        }

        const convert = new (formats.get(this.local.ext))(this);

        const asset = await convert.convert();

        if (path.parse(asset).ext === '.geojsonld') {
            const geouploader = new Upload({
                client: s3,
                params: {
                    Bucket: this.msg.bucket,
                    Key: `profile/${this.msg.job.username}/${this.msg.job.id}.geojsonld`,
                    Body: fs.createReadStream(asset)
                }
            });
            await geouploader.done();

            const tp = new Tippecanoe();

            console.log(`ok - tiling ${asset}`);
            await tp.tile(
                fs.createReadStream(asset),
                path.resolve(this.local.tmpdir, path.parse(asset).name + '.pmtiles'), {
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
        } else {
            console.log(`ok - converting ${asset}`);
            const pmout = cp.execFileSync('pmtiles', ['convert', asset, path.resolve(this.local.tmpdir, path.parse(asset).name + '.pmtiles')]);
            console.log(String(pmout));

            console.log(`ok - converted: ${path.resolve(this.local.tmpdir, path.parse(asset).name + '.pmtiles')}`);
        }

        const pmuploader = new Upload({
            client: s3,
            params: {
                Bucket: this.msg.bucket,
                Key: `profile/${this.msg.job.username}/${this.msg.job.id}.pmtiles`,
                Body: fs.createReadStream(path.resolve(this.local.tmpdir, path.parse(asset).name + '.pmtiles'))
            }
        });

        await pmuploader.done();
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

import fs from 'node:fs';
import jwt from 'jsonwebtoken';
import type { Message, LocalMessage, Asset } from './types.ts';
import s3client from './s3.ts'
import { Upload } from '@aws-sdk/lib-storage';
import path from 'node:path';
import cp from 'node:child_process';

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
    asset: Asset;

    constructor(
        msg: Message,
        local: LocalMessage,
        asset: Asset
    ) {
        this.msg = msg;
        this.local = local;
        this.asset = asset;
    }

    async run() {
        const s3 = s3client();

        if (!formats.has(this.local.ext)) {
            throw new Error('Unsupported Input Format');
        }

        const convert = new (formats.get(this.local.ext))(this.msg, this.local);

        const asset = await convert.convert();

        const artifacts: Array<{ ext: string }> = this.asset.artifacts.map(a => ({ ext: a.ext }));

        if (path.parse(asset).ext === '.geojsonld') {
            const geouploader = new Upload({
                client: s3,
                params: {
                    Bucket: this.msg.bucket,
                    Key: `profile/${this.msg.job.username}/${this.asset.id}.geojsonld`,
                    Body: fs.createReadStream(asset)
                }
            });
            await geouploader.done();

            artifacts.push({ ext: '.geojsonld' });
            const res = await fetch(new URL(`/api/profile/asset/${this.asset.id}`, this.msg.api), {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${jwt.sign({ access: 'user', email: this.msg.job.username }, this.msg.secret)}`,
                },
                body: JSON.stringify({ artifacts })
            });

            if (!res.ok) {
                throw new Error(`Failed to update asset: ${await res.text()}`);
            } else {
                this.asset = await res.json() as Asset;
            }

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
                Key: `profile/${this.msg.job.username}/${this.asset.id}.pmtiles`,
                Body: fs.createReadStream(path.resolve(this.local.tmpdir, path.parse(asset).name + '.pmtiles'))
            }
        });

        await pmuploader.done();

        artifacts.push({ ext: '.pmtiles' });
        const res = await fetch(new URL(`/api/profile/asset/${this.asset.id}`, this.msg.api), {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${jwt.sign({ access: 'user', email: this.msg.job.username }, this.msg.secret)}`,
            },
            body: JSON.stringify({ artifacts })
        });

        if (!res.ok) {
            throw new Error(`Failed to update asset: ${await res.text()}`);
        } else {
            this.asset = await res.json() as Asset;
        }
    }
}

import fs from 'node:fs';
import readline from 'node:readline';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import type { Message, LocalMessage, Asset } from './types.ts';
import s3client from './s3.ts'
import { Upload } from '@aws-sdk/lib-storage';
import path from 'node:path';
import cp from 'node:child_process';

import Tippecanoe from './tippecanoe.ts';

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

        const conversion = await convert.convert();

        const artifacts: Array<{ ext: string }> = this.asset.artifacts.map(a => ({ ext: a.ext }));

        if (conversion.icons && conversion.icons.size > 0) {
            console.error('ok - Creating Iconset');

            const iconset = randomUUID();

            const iconsetRes = await fetch(new URL(`/api/iconset`, this.msg.api), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${jwt.sign({ access: 'user', email: this.msg.job.username }, this.msg.secret)}`,
                },
                body: JSON.stringify({
                    uid: iconset,
                    version: 1,
                    name: `${this.msg.job.name} Icons`,
                    internal: true,
                    scope: 'user'

                })
            })

            // Map of original icon name to new icon name if name is incompatible
            const iconNameMap = new Map<string, string>();

            if (!iconsetRes.ok) {
                console.error(`err - Failed to create iconset: ${await iconsetRes.text()}`);
            } else {
                for (const icon of conversion.icons) {
                    const url = new URL(`/api/iconset/${iconset}/icon`, this.msg.api);
                    url.searchParams.append('regen', 'false');

                    if (icon.name.startsWith('http')) {
                        const iconUrl = new URL(icon.name);

                        const name = path.parse(iconUrl.pathname).name + '.png';

                        // If URLs are like example.com/icon.png?v=123 we need to randomize the name
                        if (!name || iconUrl.searchParams.size !== 0) {
                            const rando = randomUUID();
                            iconNameMap.set(icon.name, rando);
                            icon.name = rando + '.png';
                        } else {
                            iconNameMap.set(icon.name, name);
                            icon.name = name;
                        }
                    }

                    const iconRes = await fetch(url, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${jwt.sign({ access: 'user', email: this.msg.job.username }, this.msg.secret)}`,
                        },
                        body: JSON.stringify({
                            name: icon.name,
                            data: icon.data
                        })
                    })

                    if (!iconRes.ok) {
                        console.error(`err - Failed to upload icon: ${await iconRes.text()}`);
                    }
                }

                const regen = await fetch(new URL(`/api/iconset/${iconset}/regen`, this.msg.api), {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${jwt.sign({ access: 'user', email: this.msg.job.username }, this.msg.secret)}`,
                    }
                });

                if (!regen.ok) {
                    throw new Error(`Failed to update asset: ${await regen.text()}`);
                }

                const res = await fetch(new URL(`/api/profile/asset/${this.asset.id}`, this.msg.api), {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${jwt.sign({ access: 'user', email: this.msg.job.username }, this.msg.secret)}`,
                    },
                    body: JSON.stringify({ iconset })
                });

                if (!res.ok) {
                    throw new Error(`Failed to update asset: ${await res.text()}`);
                } else {
                    this.asset = await res.json() as Asset;
                }
            }

            // Iterate over features and prefix with Iconset UID
            // Do it as a stream to ensure memory efficiency
            if (path.parse(conversion.asset).ext === '.geojsonld') {
                const tmpAsset = path.resolve(this.local.tmpdir, randomUUID() + '.geojsonld');
                const readStream = fs.createReadStream(conversion.asset);
                const writeStream = fs.createWriteStream(tmpAsset);

                const rl = readline.createInterface({
                    input: readStream,
                    crlfDelay: Infinity
                });

                for await (const line of rl) {
                    if (!line.trim()) continue;
                    const feat = JSON.parse(line);
                    if (feat.properties && feat.properties.icon) {
                        if (iconNameMap.has(feat.properties.icon)) {
                            feat.properties.icon = iconNameMap.get(feat.properties.icon);
                        }

                        // Remove File Extension from icon name - but retain path/directory
                        feat.properties.icon = iconset + ':' + feat.properties.icon.replace(/(\.[^/.]+)$/, '');
                    }

                    writeStream.write(JSON.stringify(feat) + '\n');
                }

                await new Promise((resolve) => {
                    writeStream.end(resolve);
                });

                fs.renameSync(tmpAsset, conversion.asset);
            }
        }

        if (path.parse(conversion.asset).ext === '.geojsonld') {
            const geouploader = new Upload({
                client: s3,
                params: {
                    Bucket: this.msg.bucket,
                    Key: `profile/${this.msg.job.username}/${this.asset.id}.geojsonld`,
                    Body: fs.createReadStream(conversion.asset)
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

            console.log(`ok - tiling ${conversion.asset}`);
            await tp.tile(
                fs.createReadStream(conversion.asset),
                path.resolve(this.local.tmpdir, path.parse(conversion.asset).name + '.pmtiles'), {
                    std: true,
                    quiet: false,
                    name: this.msg.job.name,
                    description: 'Automatically Converted by @tak-ps/etl',
                    layer: 'out',
                    force: true,
                    limit: {
                        features: false,
                        size: false
                    },
                    zoom: {
                        min: 0,
                        base: 6,
                        max: 14,
                    }
                }
            );
        } else {
            console.log(`ok - converting ${conversion.asset}`);
            const pmout = cp.execFileSync('pmtiles', ['convert', conversion.asset, path.resolve(this.local.tmpdir, path.parse(conversion.asset).name + '.pmtiles')]);
            console.log(String(pmout));

            console.log(`ok - converted: ${path.resolve(this.local.tmpdir, path.parse(conversion.asset).name + '.pmtiles')}`);
        }

        const pmuploader = new Upload({
            client: s3,
            params: {
                Bucket: this.msg.bucket,
                Key: `profile/${this.msg.job.username}/${this.asset.id}.pmtiles`,
                Body: fs.createReadStream(path.resolve(this.local.tmpdir, path.parse(conversion.asset).name + '.pmtiles'))
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

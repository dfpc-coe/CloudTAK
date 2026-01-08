import fs from 'node:fs/promises';
import type { Message, LocalMessage, Transform, ConvertResponse } from '../types.ts';
import path from 'node:path';
import Sharp from 'sharp';
import { glob } from 'glob';
import StreamZip from 'node-stream-zip';
import { kml } from '@tmcw/togeojson';
import { DOMParser } from '@xmldom/xmldom';

export default class KML implements Transform {
    static register() {
        return {
            inputs: ['.kml', '.kmz']
        };
    }

    msg: Message;
    local: LocalMessage;

    constructor(
        msg: Message,
        local: LocalMessage
    ) {
        this.msg = msg;
        this.local = local;
    }

    async convert(): Promise<ConvertResponse> {
        const icons = new Map();

        let asset;

        if (this.local.ext === '.kmz') {
            const zip = new StreamZip.async({
                file: this.local.raw,
                skipEntryNameValidation: true
            });

            const preentries = await zip.entries();

            if (!preentries['doc.kml']) throw new Error('No doc.kml found in KMZ');

            await zip.extract(null, this.local.tmpdir);

            asset = path.resolve(this.local.tmpdir, 'doc.kml');
        } else {
            asset = path.resolve(this.local.raw);
        }

        const dom = new DOMParser().parseFromString(String(await fs.readFile(asset)), 'text/xml');

        const converted = kml(dom).features;

        for (const feat of converted) {
            if (!feat.properties) feat.properties = {};

            if (feat.properties.icon && !icons.has(feat.properties.icon)) {
                if (feat.properties.icon.startsWith('http')) {
                    try {
                        const res = await fetch(feat.properties.icon);

                        if (!res.ok) {
                            throw new Error(`HTTP ${res.status} ${await res.text()}`);
                        }

                        const iconbuffer = Buffer.from(await res.arrayBuffer());

                        icons.set(feat.properties.icon, iconbuffer);
                    } catch (err) {
                        console.warn(`icon ${feat.properties.icon} not retrievable (${err})`);
                    }
                } else {
                    const search = await glob(path.resolve(this.local.tmpdir, '**/' + feat.properties.icon));
                    if (!search.length) {
                        console.warn(`icon ${feat.properties.icon} not found`);
                        continue;
                    }

                    icons.set(feat.properties.icon, await fs.readFile(search[0]));
                }
            }
        }

        console.error('ok - converted to GeoJSON');

        const output = path.resolve(this.local.tmpdir, this.local.id + '.geojsonld');

        await fs.writeFile(output, converted.map((feat) => {
            return JSON.stringify(feat);
        }).join('\n'));

        const iconMap = new Set<{
            name: string;
            data: string;
        }>();

        for (const [name, icon] of icons.entries()) {
            try {
                const contents = await (Sharp(icon)
                    .png()
                    .toBuffer());

                iconMap.add({
                    name: name.replace(/.[a-z]+$/, '.png'),
                    data: `data:image/png;base64,${contents.toString('base64')}`
                });
            } catch (err) {
                console.error(`failing to process ${name}`, err);
            }
        }

        if (iconMap.size) {
            return {
                asset: output,
                icons: iconMap
            }
        } else {
            return {
                asset: output
            }
        }
    }
}

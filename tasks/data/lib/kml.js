import fs from 'node:fs/promises';
import path from 'node:path';
import spritesmith from 'spritesmith';
import Sharp from 'sharp';
import Vinyl from 'vinyl';
import { glob } from 'glob';
import StreamZip from 'node-stream-zip';
import { kml } from '@tmcw/togeojson';
import { DOMParser } from '@xmldom/xmldom';
import { promisify } from 'node:util';

const SpriteSmith = promisify(spritesmith.run);

export default class KML {
    static register() {
        return {
            inputs: ['.kml', '.kmz']
        };
    }

    constructor(task) {
        this.task = task;
    }

    async convert() {
        const { ext } = path.parse(path.resolve(this.task.temp, this.task.etl.task.asset));

        const icons = new Map();

        let asset;

        if (ext === '.kmz') {
            const zip = new StreamZip.async({
                file: path.resolve(this.task.temp, this.task.etl.task.asset),
                skipEntryNameValidation: true
            });

            const preentries = await zip.entries();

            if (!preentries['doc.kml']) throw new Error('No doc.kml found in KMZ');

            await zip.extract(null, this.task.temp);

            asset = path.resolve(this.task.temp, 'doc.kml');
        } else {
            asset = path.resolve(this.task.temp, this.task.etl.task.asset);
        }

        const dom = new DOMParser().parseFromString(String(await fs.readFile(asset)), 'text/xml');

        const converted = kml(dom).features;

        for (const feat of converted) {
            if (feat.properties.icon && !icons.has(feat.properties.icon)) {
                const search = await glob(path.resolve(this.task.temp, '**/' + feat.properties.icon));
                if (!search.length) continue;

                icons.set(feat.properties.icon, await fs.readFile(search[0]));
            }
        }

        console.error('ok - converted to GeoJSON');

        const output = path.resolve(this.task.temp, path.parse(this.task.etl.task.asset).name + '.geojsonld');

        await fs.writeFile(output, converted.map((feat) => {
            return JSON.stringify(feat);
        }).join('\n'));

        const src = [];
        for (const [name, icon] of icons.entries()) {
            try {
                const contents = await (Sharp(icon)
                    .resize(32, 32, {
                        fit: 'contain',
                        background: { r: 0, g: 0, b: 0, alpha: 0 }
                    })
                    .png()
                    .toBuffer());

                src.push(new Vinyl({
                    path: name.replace(/.[a-z]+$/, '.png'),
                    contents
                }));
            } catch (err) {
                console.error(`failing to process ${name}`, err);
            }
        }

        const doc = await SpriteSmith({ src });

        const coords = {};
        for (const key in doc.coordinates) {
            coords[key.replace(/.png/, '')] = {
                ...doc.coordinates[key],
                pixelRatio: 1
            };
        }

        return output;
    }
}

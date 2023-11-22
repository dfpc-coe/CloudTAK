import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { kml } from '@tmcw/togeojson';
import { DOMParser } from '@xmldom/xmldom';

export default class KML {
    static register() {
        return {
            inputs: ['.kml']
        };
    }

    constructor(etl) {
        this.etl = etl;
    }

    async convert() {
        const dom = new DOMParser().parseFromString(String(await fs.readFile(path.resolve(os.tmpdir(), this.etl.task.asset))), 'text/xml');

        const converted = kml(dom).features.map((feat) => {
            return JSON.stringify(feat);
        }).join('\n');
        console.error('ok - converted to GeoJSON');

        const output = path.resolve(os.tmpdir(), path.parse(this.etl.task.asset).base + '.geojsonld');

        await fs.writeFile(output, converted);

        return output;
    }
}

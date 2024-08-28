import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import StreamZip from 'node-stream-zip'
import { kml } from '@tmcw/togeojson';
import { DOMParser } from '@xmldom/xmldom';

export default class KML {
    static register() {
        return {
            inputs: ['.kml', '.kmz']
        };
    }

    constructor(etl) {
        this.etl = etl;
    }

    async convert() {
        const { ext } = path.parse(path.resolve(os.tmpdir(), this.etl.task.asset));

        let asset;

        if (ext === '.kmz') {
            const zip = new StreamZip.async({
                file: path.resolve(os.tmpdir(), this.etl.task.asset),
                skipEntryNameValidation: true
            });

            const preentries = await zip.entries();

            if (!preentries['doc.kml']) throw new Err(400, null, 'No doc.kml found in KMZ');

            await zip.extract(null, os.tmpdir());

            asset = path.resolve(os.tmpdir(), 'doc.kml')
        } else {
            asset = path.resolve(os.tmpdir(), this.etl.task.asset)
        }

        const dom = new DOMParser().parseFromString(String(await fs.readFile(asset)), 'text/xml');

        const converted = kml(dom).features.map((feat) => {
            return JSON.stringify(feat);
        }).join('\n');
        console.error('ok - converted to GeoJSON');

        const output = path.resolve(os.tmpdir(), path.parse(this.etl.task.asset).name + '.geojsonld');

        await fs.writeFile(output, converted);

        return output;
    }
}

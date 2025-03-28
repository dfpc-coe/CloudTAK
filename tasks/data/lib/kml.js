import fs from 'node:fs/promises';
import path from 'node:path';
import StreamZip from 'node-stream-zip';
import { kml } from '@tmcw/togeojson';
import { DOMParser } from '@xmldom/xmldom';

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
                console.error(path.resolve(this.task.temp, 'doc.kml'));
                icons.set(feat.properties.icon, new Buffer());
            }
        }

        console.error('ok - converted to GeoJSON');

        const output = path.resolve(this.task.temp, path.parse(this.task.etl.task.asset).name + '.geojsonld');

        await fs.writeFile(output, converted.map((feat) => {
            return JSON.stringify(feat);
        }).join('\n'));

        return output;
    }
}

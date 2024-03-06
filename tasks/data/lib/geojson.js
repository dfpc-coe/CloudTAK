import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export default class GeoJSON {
    static register() {
        return {
            inputs: ['.geojsonld']
        };
    }

    constructor(etl) {
        this.etl = etl;
    }

    async convert() {
        console.error('ok - converted to GeoJSON');
        return path.resolve(os.tmpdir(), this.etl.task.asset)
    }
}

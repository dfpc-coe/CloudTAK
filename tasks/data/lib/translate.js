import os from 'node:os';
import path from 'node:path';
import cp from 'node:child_process';

export default class GDALTranslate {
    static register() {
        return {
            inputs: ['.pdf']
        };
    }

    constructor(etl) {
        this.etl = etl;
    }

    async convert() {
        const input = path.resolve(os.tmpdir(), this.etl.task.asset);
        const output = path.resolve(os.tmpdir(), path.parse(this.etl.task.asset).name + '.mbtiles');

        const run = cp.execSync(`gdal_translate ${input} ${output}`);
        console.error(run);

        return output;
    }
}

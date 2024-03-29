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

        const env = {};
        if (path.parse(this.etl.task.asset).ext === '.pdf') {
            env['GDAL_PDF_DPI'] = '300';
        }

        const run = cp.execSync(`gdal_translate ${input} ${output}`, { env });
        console.error(run);

        const runadd = cp.execSync(`gdaladdo ${output} 2 4 8 16 32 64 128`);
        console.error(runadd);

        return output;
    }
}

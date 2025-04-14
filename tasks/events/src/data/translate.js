import path from 'node:path';
import cp from 'node:child_process';

export default class GDALTranslate {
    static register() {
        return {
            inputs: ['.pdf', '.tif']
        };
    }

    constructor(task) {
        this.task = task;
    }

    async convert() {
        const input = path.resolve(this.task.temp, this.task.etl.task.asset);
        const output = path.resolve(this.task.temp, path.parse(this.task.etl.task.asset).name + '.mbtiles');

        const env = {};
        if (path.parse(this.task.etl.task.asset).ext === '.pdf') {
            env['GDAL_PDF_DPI'] = '300';
        }

        cp.execFileSync('gdal_translate', [input, output], { env });

        cp.execFileSync('gdaladdo', ['-r', 'cubic', output]);

        return output;
    }
}

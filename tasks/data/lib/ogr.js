import os from 'node:os';
import path from 'node:path';
import cp from 'node:child_process';

export default class OGR {
    static register() {
        return {
            inputs: ['.gpx']
        };
    }

    constructor(etl) {
        this.etl = etl;
    }

    async convert() {
        const input = path.resolve(os.tmpdir(), this.etl.task.asset);
        const output = path.resolve(os.tmpdir(), path.parse(this.etl.task.asset).name + '.geojson');

        const env = {};
        if (path.parse(this.etl.task.asset).ext === '.gpx') {
            env['FORCE_GPX_TRACK'] = 'YES';
        }

        const run = cp.execSync(`ogr2ogr -nlt GEOMETRY ${output} ${input}`, { env });
        console.error(run);

        return output;
    }
}

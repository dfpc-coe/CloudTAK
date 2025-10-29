import path from 'node:path';
import type { Message, LocalMessage } from '../types.ts';
import cp from 'node:child_process';

export default class GDALTranslate {
    static register() {
        return {
            inputs: ['.pdf', '.tif', '.tiff']
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

    async convert() {
        const input = path.resolve(this.local.tmpdir, this.local.raw);
        const output = path.resolve(this.local.tmpdir, path.parse(this.local.raw).name + '.mbtiles');

        const env: Record<string, string> = {};
        if (path.parse(this.local.raw).ext === '.pdf') {
            env['GDAL_PDF_DPI'] = '300';
        }

        cp.execFileSync('gdal', ['raster', 'convert', input, output], { env });

        cp.execFileSync('gdal', ['raster', 'overview', '-r', 'cubic', output]);

        return output;
    }
}

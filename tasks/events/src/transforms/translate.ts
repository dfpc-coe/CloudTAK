import path from 'node:path';
import type { Message, LocalMessage, Transform, ConvertResponse } from '../types.ts';
import cp from 'node:child_process';

export default class GDALTranslate implements Transform {
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

    async convert(): Promise<ConvertResponse> {
        const input = path.resolve(this.local.tmpdir, this.local.raw);
        const output = path.resolve(this.local.tmpdir, path.parse(this.local.raw).name + '.mbtiles');

        const env: Record<string, string> = {};
        if (path.parse(this.local.raw).ext === '.pdf') {
            env['GDAL_PDF_DPI'] = '300';
        }

        const args = [input, output];

        const info = cp.execFileSync('gdalinfo', ['-json', input], { env }).toString();
        const gdalinfo = JSON.parse(info);
        if (gdalinfo.geoTransform) {
            const pixelWidth = Math.abs(gdalinfo.geoTransform[1]);
            const pixelHeight = Math.abs(gdalinfo.geoTransform[5]);
            const minRes = Math.min(pixelWidth, pixelHeight);
            // MBTiles zoom level formula: zoom = log2(360 / (res * 256))
            const zoom = Math.ceil(Math.log2(360 / (minRes * 256)));
            if (zoom > 22) {
                args.unshift('-co', 'ZOOM_LEVEL=22');
            }
        }

        cp.execFileSync('gdal_translate', args, { env });

        cp.execFileSync('gdaladdo', ['-r', 'cubic', output]);

        return {
            asset: output
        }
    }
}

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

        try {
            const info = cp.execFileSync('gdalinfo', ['-json', input], { env }).toString();
            const gdalinfo = JSON.parse(info);
            const geoTransform = gdalinfo.geoTransform;
            if (
                Array.isArray(geoTransform)
                && typeof geoTransform[1] === 'number'
                && typeof geoTransform[5] === 'number'
            ) {
                const pixelWidth = Math.abs(geoTransform[1]);
                const pixelHeight = Math.abs(geoTransform[5]);
                const minRes = Math.min(pixelWidth, pixelHeight);

                if (minRes > 0) {
                    // Determine whether the resolution is in degrees or meters based on the SRS
                    let resDegrees = minRes;
                    const srs: string | undefined = gdalinfo.coordinateSystem?.wkt;
                    if (srs && /PROJCS|UNIT\["metre"/i.test(srs)) {
                        // Convert meters to approximate degrees at the equator
                        resDegrees = minRes / 111320;
                    }

                    // MBTiles zoom level formula: zoom = log2(360 / (resDegrees * 256))
                    const zoom = Math.ceil(Math.log2(360 / (resDegrees * 256)));
                    if (zoom > 22) {
                        args.unshift('-co', 'MAXZOOM=22');
                    }
                }
            }
        } catch {
            // If metadata sniffing fails, continue without zoom clamping
        }

        cp.execFileSync('gdal_translate', args, { env });

        cp.execFileSync('gdaladdo', ['-r', 'cubic', output]);

        return {
            asset: output
        }
    }
}

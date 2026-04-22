import path from 'node:path';
import type { Message, LocalMessage, Transform, ConvertResponse } from '../types.ts';
import cp from 'node:child_process';

const MAX_ZOOM = 22;
const MAX_RESOLUTION_DEGREES = 360 / (Math.pow(2, MAX_ZOOM) * 256);
const EQUATOR_METERS_PER_DEGREE = 111320;

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

        const env: Record<string, string> = {
            ...process.env as Record<string, string>,
            GDAL_NUM_THREADS: 'ALL_CPUS',
            GDAL_CACHEMAX: '512',
        };
        if (path.parse(this.local.raw).ext === '.pdf') {
            env['GDAL_PDF_DPI'] = '300';
        }

        const args = [input, output];

        // Downsample excessively high-resolution rasters before tiling.
        // MBTiles raster zoom is derived from pixel resolution — there is no
        // creation option to cap it, so we warp down to zoom-22-equivalent
        // resolution (~0.0000134 degrees ≈ ~1.49 m at the equator) first.
        let translateInput = input;
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
                    let resDegrees = minRes;
                    let maxRes = MAX_RESOLUTION_DEGREES;
                    const srs: string | undefined = gdalinfo.coordinateSystem?.wkt;
                    if (srs && /(^|[\[,])PROJ(?:CRS|CS)\[/i.test(srs)) {
                        resDegrees = minRes / 111320;
                        maxRes = MAX_RESOLUTION_DEGREES * EQUATOR_METERS_PER_DEGREE;
                    }

                    // zoom = log2(360 / (resDegrees * 256))
                    const zoom = Math.ceil(Math.log2(360 / (resDegrees * 256)));
                    if (zoom > MAX_ZOOM) {
                        const warped = path.resolve(this.local.tmpdir, path.parse(this.local.raw).name + '-warped.tif');
                        cp.execFileSync('gdalwarp', [
                            '-tr', String(maxRes), String(maxRes),
                            '-r', 'cubic',
                            input, warped
                        ], { env });
                        translateInput = warped;
                    }
                }
            }
        } catch {
            // If metadata sniffing fails, continue without zoom clamping
        }

        args[0] = translateInput;

        cp.execFileSync('gdal_translate', args, { env });

        cp.execFileSync('gdaladdo', ['-r', 'cubic', output, '2', '4', '8', '16', '32', '64', '128', '256'], { env });

        return {
            asset: output
        }
    }
}

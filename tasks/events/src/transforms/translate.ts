import path from 'node:path';
import type { Message, LocalMessage, Transform, ConvertResponse } from '../types.ts';
import cp from 'node:child_process';

const MAX_ZOOM = 22;
const MAX_RESOLUTION_DEGREES = 360 / (Math.pow(2, MAX_ZOOM) * 256);
const EQUATOR_METERS_PER_DEGREE = 111320;

export default class GDALTranslate implements Transform {
    static register() {
        return {
            inputs: ['.pdf', '.tif', '.tiff'],
        };
    }

    msg: Message;
    local: LocalMessage;

    constructor(
        msg: Message,
        local: LocalMessage,
    ) {
        this.msg = msg;
        this.local = local;
    }

    async convert(): Promise<ConvertResponse> {
        const input = path.resolve(this.local.tmpdir, this.local.raw);
        const output = path.resolve(this.local.tmpdir, path.parse(this.local.raw).name + '.mbtiles');

        const isPDF = path.parse(this.local.raw).ext === '.pdf';

        const env: Record<string, string> = {
            ...process.env as Record<string, string>,
            GDAL_NUM_THREADS: 'ALL_CPUS',
            GDAL_CACHEMAX: '512',
        };

        if (isPDF) {
            env['GDAL_PDF_DPI'] = '300';
        }

        // Open options for the source dataset (PDF-specific georeferencing)
        const openOpts: string[] = [];
        if (isPDF) {
            // Handle GeoPDFs that store georeferencing in PDF structure
            // rather than as standard GeoTransform or GCPs
            openOpts.push('--oo', 'SRC_METHOD=NO_GEOTRANSFORM');
        }

        // Downsample excessively high-resolution rasters before tiling.
        // MBTiles raster zoom is derived from pixel resolution — there is no
        // creation option to cap it, so we warp down to zoom-22-equivalent
        // resolution (~0.0000134 degrees ≈ ~1.49 m at the equator) first.
        let convertInput = input;

        let gdalinfo;
        try {
            // Run gdal raster info WITHOUT SRC_METHOD=NO_GEOTRANSFORM to detect
            // whether the file actually contains geospatial information
            const info = cp.execFileSync('gdal', [
                'raster', 'info', '--format=json', input,
            ], { env }).toString();
            gdalinfo = JSON.parse(info);

            // Validate that PDF contains geospatial information (GeoPDF vs regular PDF)
            if (isPDF) {
                const geoTransform = gdalinfo.geoTransform;
                const hasGeoTransform = Array.isArray(geoTransform) && geoTransform.length === 6;
                const hasGCPs = Array.isArray(gdalinfo.gcps) && gdalinfo.gcps.length > 0;

                if (!hasGeoTransform && !hasGCPs) {
                    throw new Error(
                        'The uploaded PDF does not contain geospatial information. '
                        + 'Please upload a GeoPDF file with embedded georeferencing data '
                        + '(coordinate system, geo transform, or ground control points).',
                    );
                }
            }
        } catch (err) {
            if (err instanceof Error && err.message.includes('geospatial information')) {
                throw err;
            }
            // For non-PDF rasters, continue without zoom clamping
        }

        try {
            if (gdalinfo) {
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
                        if (srs && /(^|[[,])PROJ(?:CRS|CS)\[/i.test(srs)) {
                            resDegrees = minRes / 111320;
                            maxRes = MAX_RESOLUTION_DEGREES * EQUATOR_METERS_PER_DEGREE;
                        }

                        // zoom = log2(360 / (resDegrees * 256))
                        const zoom = Math.ceil(Math.log2(360 / (resDegrees * 256)));
                        if (zoom > MAX_ZOOM) {
                            const warped = path.resolve(this.local.tmpdir, path.parse(this.local.raw).name + '-warped.tif');
                            cp.execFileSync('gdal', [
                                'raster', 'reproject',
                                '--resolution', `${maxRes},${maxRes}`,
                                '--resampling', 'cubic',
                                ...openOpts,
                                '--overwrite',
                                input, warped,
                            ], { env });

                            convertInput = warped;
                        }
                    }
                }
            }
        } catch {
            // If zoom clamping fails, continue without it
        }

        cp.execFileSync('gdal', [
            'raster', 'convert',
            '--overwrite',
            convertInput, output,
        ], { env });

        cp.execFileSync('gdal', [
            'raster', 'overview', 'add',
            '--resampling', 'cubic',
            '--levels', '2,4,8,16,32,64,128,256',
            output,
        ], { env });

        return {
            asset: output,
        };
    }
}

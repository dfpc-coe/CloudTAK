import fs from 'node:fs';
import path from 'node:path';
import type { Message, LocalMessage, Transform, ConvertResponse } from '../types.ts';
import { run } from '../utils.ts';
import GDALTranslate from './translate.ts';
import { validateShapefilePackage } from './shapefile.ts';

type VectorInfo = {
    layers?: unknown[];
};

type RasterInfo = {
    bands?: unknown[];
};

export default class Geodatabase implements Transform {
    static register() {
        return {
            inputs: ['.gdb'],
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
        const input = path.resolve(this.local.raw);
        const shapefiles = this.findShapefiles(input);
        for (const shapefile of shapefiles) validateShapefilePackage(shapefile);

        const vectorInput = shapefiles[0] || input;
        const vectorInfo = this.probe<VectorInfo>(['vector', 'info', '--format=json', vectorInput]);
        const rasterInfo = this.probe<RasterInfo>(['raster', 'info', '--format=json', input]);
        const hasVector = Array.isArray(vectorInfo?.layers) && vectorInfo.layers.length > 0;
        const hasRaster = Array.isArray(rasterInfo?.bands) && rasterInfo.bands.length > 0;

        if (hasVector && hasRaster) {
            throw new Error(
                'Uploading a file geodatabase containing both raster and vector data is not currently supported. '
                + 'Support for mixed raster and vector geodatabases will be added soon.',
            );
        }

        if (hasVector) {
            const output = path.resolve(this.local.tmpdir, `${this.local.id}.geojsonld`);
            run('gdal', [
                'vector', 'convert',
                '--overwrite',
                '--output-format', 'GeoJSONSeq',
                vectorInput,
                output,
            ]);

            return { asset: output };
        }

        if (hasRaster) {
            return await new GDALTranslate(this.msg, this.local).convert();
        }

        throw new Error(
            `The file geodatabase '${this.local.name}' does not contain supported geospatial data. `
            + 'Please upload a .gdb folder containing vector or raster data.',
        );
    }

    private probe<T>(args: string[]): T | undefined {
        try {
            return JSON.parse(run('gdal', args, {
                stdio: ['ignore', 'pipe', 'pipe'],
            })) as T;
        } catch {
            return undefined;
        }
    }

    private findShapefiles(directory: string): string[] {
        if (!fs.statSync(directory).isDirectory()) return [];

        return fs.readdirSync(directory, { recursive: true, withFileTypes: true })
            .filter(entry => entry.isFile() && path.extname(entry.name).toLowerCase() === '.shp')
            .map(entry => path.join(entry.parentPath, entry.name));
    }
}

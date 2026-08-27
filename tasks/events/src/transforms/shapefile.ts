import fs from 'node:fs';
import path from 'node:path';
import type { Message, LocalMessage, Transform, ConvertResponse } from '../types.ts';
import { run } from '../utils.ts';

export function validateShapefilePackage(input: string): void {
    const base = path.join(path.dirname(input), path.parse(input).name);
    const requiredFiles = ['.shp', '.dbf', '.shx', '.prj'].map(ext => `${base}${ext}`);

    if (requiredFiles.some(file => !fs.existsSync(file))) {
        throw new Error(
            `In order to add a valid Shapefile package: compress and upload the entire `
            + `'${path.parse(path.dirname(input)).name}' folder. `
            + `Folder contents should include: '${path.parse(base).name}.shp', '${path.parse(base).name}.dbf', `
            + `'${path.parse(base).name}.shx', '${path.parse(base).name}.prj'.`,
        );
    }
}

export default class Shapefile implements Transform {
    static register() {
        return {
            inputs: ['.shp'],
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
        const output = path.resolve(this.local.tmpdir, `${this.local.id}.geojsonld`);
        validateShapefilePackage(input);

        run('gdal', [
            'vector', 'convert',
            '--overwrite',
            '--output-format', 'GeoJSONSeq',
            input,
            output,
        ]);

        return {
            asset: output,
        };
    }
}

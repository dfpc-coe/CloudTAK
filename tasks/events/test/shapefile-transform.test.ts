import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import Shapefile from '../src/transforms/shapefile.js';
import type { Message, LocalMessage } from '../src/types.js';

test('Shapefile Transform: bare .shp uploads fail with packaging guidance', async () => {
    const tmpdir = await fs.promises.mkdtemp('/tmp/shapefile-test-');
    const inputFile = path.join(tmpdir, 'roads.shp');
    await fs.promises.writeFile(inputFile, 'not-a-real-shapefile');

    const transform = new Shapefile({} as Message, {
        tmpdir,
        name: 'roads.shp',
        ext: '.shp',
        id: 'roads',
        raw: inputFile,
    } as LocalMessage);

    try {
        await assert.rejects(
            () => transform.convert(),
            new Error("In order to add a valid Shapefile package: compress (.zip) the entire data folder. Folder contents should include: 'roads.shp', 'roads.dbf', 'roads.shx', 'roads.prj'."),
        );
    } finally {
        await fs.promises.rm(tmpdir, { recursive: true, force: true });
    }
});
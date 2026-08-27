import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import cp from 'node:child_process';
import Sinon from 'sinon';
import Geodatabase from '../src/transforms/geodatabase.js';
import type { Message, LocalMessage } from '../src/types.js';

test('Geodatabase Transform', async (t) => {
    const tmpdir = await fs.promises.mkdtemp('/tmp/geodatabase-test-');

    t.after(async () => {
        Sinon.restore();
        await fs.promises.rm(tmpdir, { recursive: true, force: true });
    });

    const createTransform = (name = 'example.gdb') => {
        const input = path.join(tmpdir, name);
        fs.mkdirSync(input, { recursive: true });

        return new Geodatabase({} as Message, {
            tmpdir,
            name,
            ext: '.gdb',
            id: 'geodatabase',
            raw: input,
        } as LocalMessage);
    };

    await t.test('rejects mixed vector and raster data', async () => {
        const exec = Sinon.stub(cp, 'execFileSync');
        exec.onFirstCall().returns(Buffer.from(JSON.stringify({ layers: [{}] })));
        exec.onSecondCall().returns(Buffer.from(JSON.stringify({ bands: [{}] })));

        await assert.rejects(
            () => createTransform().convert(),
            /both raster and vector data is not currently supported.*added soon/,
        );
        exec.restore();
    });

    await t.test('uses shapefile packaging errors for incomplete vector content', async () => {
        const transform = createTransform('incomplete.gdb');
        await fs.promises.writeFile(path.join(tmpdir, 'incomplete.gdb', 'roads.shp'), 'invalid');

        await assert.rejects(
            () => transform.convert(),
            /valid Shapefile package.*roads\.dbf.*roads\.shx.*roads\.prj/,
        );
    });

    await t.test('rejects a geodatabase without geospatial data', async () => {
        const exec = Sinon.stub(cp, 'execFileSync');
        exec.onFirstCall().returns(Buffer.from(JSON.stringify({ layers: [] })));
        exec.onSecondCall().returns(Buffer.from(JSON.stringify({ bands: [] })));

        await assert.rejects(
            () => createTransform('empty.gdb').convert(),
            /does not contain supported geospatial data/,
        );
        exec.restore();
    });
});

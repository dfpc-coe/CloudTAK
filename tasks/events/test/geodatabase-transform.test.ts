import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import cp from 'node:child_process';
import Sinon from 'sinon';
import StreamZip from 'node-stream-zip';
import Geodatabase from '../src/transforms/geodatabase.js';
import GDALTranslate from '../src/transforms/translate.js';
import type { Message, LocalMessage } from '../src/types.js';

const FIXTURE_ZIP = path.resolve(import.meta.dirname, 'fixtures/geodatabase/boulder.zip');

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

    await t.test('routes raster data through GDALTranslate', async () => {
        const exec = Sinon.stub(cp, 'execFileSync');
        exec.onFirstCall().returns(Buffer.from(JSON.stringify({ layers: [] })));
        exec.onSecondCall().returns(Buffer.from(JSON.stringify({ bands: [{}] })));

        const expected = { asset: path.join(tmpdir, 'raster.mbtiles') };
        const convert = Sinon.stub(GDALTranslate.prototype, 'convert').resolves(expected);

        const result = await createTransform('raster.gdb').convert();

        assert.deepEqual(result, expected);
        assert.equal(convert.callCount, 1);
        exec.restore();
        convert.restore();
    });

    await t.test('converts the flattened FileGDB fixture to GeoJSONSeq', async () => {
        const extractDir = path.join(tmpdir, 'boulder-raw');
        const geodatabasePath = path.join(tmpdir, 'boulder.gdb');
        await fs.promises.mkdir(extractDir, { recursive: true });

        const zip = new StreamZip.async({ file: FIXTURE_ZIP });
        await zip.extract(null, extractDir);
        await zip.close();
        await fs.promises.symlink(extractDir, geodatabasePath, 'dir');

        const transform = new Geodatabase({} as Message, {
            tmpdir,
            name: 'boulder.gdb',
            ext: '.gdb',
            id: 'boulder',
            raw: geodatabasePath,
        } as LocalMessage);

        const result = await transform.convert();
        const content = await fs.promises.readFile(result.asset, 'utf8');
        const features = content.trim().split('\n').map(line => JSON.parse(line));

        assert.equal(features.length, 50);
        assert.ok(features.every(feature => feature.type === 'Feature'));
        assert.ok(features.every(feature => feature.geometry?.type === 'MultiPolygon'));
    });
});

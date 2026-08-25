import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import StreamZip from 'node-stream-zip';
import Shapefile from '../src/transforms/shapefile.js';
import type { Message, LocalMessage } from '../src/types.js';

const FIXTURE_ZIP = path.resolve(import.meta.dirname, 'fixtures/shapefile/mesa_points.zip');

test('Shapefile Transform', async (t) => {
    const tmpdir = await fs.promises.mkdtemp('/tmp/shapefile-test-');

    await t.test('bare .shp upload fails with packaging guidance', async () => {
        const inputFile = path.join(tmpdir, 'corrupted-shapefile.shp');
        await fs.promises.writeFile(inputFile, 'not-a-real-shapefile');

        const transform = new Shapefile({} as Message, {
            tmpdir,
            name: 'corrupted-shapefile.shp',
            ext: '.shp',
            id: 'corrupted-shapefile',
            raw: inputFile,
        } as LocalMessage);

        await assert.rejects(
            () => transform.convert(),
            (err: Error) => {
                assert.ok(err.message.includes('corrupted-shapefile.shp'), `expected message to mention the .shp filename, got: ${err.message}`);
                assert.ok(err.message.includes('corrupted-shapefile.dbf'), `expected message to mention the .dbf filename, got: ${err.message}`);
                assert.ok(err.message.includes('corrupted-shapefile.shx'), `expected message to mention the .shx filename, got: ${err.message}`);
                assert.ok(err.message.includes('corrupted-shapefile.prj'), `expected message to mention the .prj filename, got: ${err.message}`);
                return true;
            },
        );
    });

    await t.test('converts extracted shapefile to GeoJSONSeq', async () => {
        // extract the fixture zip so all sidecar files are present alongside the .shp
        const extractDir = path.join(tmpdir, 'mesa_points');
        await fs.promises.mkdir(extractDir, { recursive: true });
        const zip = new StreamZip.async({ file: FIXTURE_ZIP });
        await zip.extract(null, extractDir);
        await zip.close();

        const shpFile = path.join(extractDir, 'mesa_points.shp');

        const transform = new Shapefile({} as Message, {
            tmpdir: extractDir,
            name: 'mesa_points.shp',
            ext: '.shp',
            id: 'mesa_points',
            raw: shpFile,
        } as LocalMessage);

        const result = await transform.convert();

        const content = await fs.promises.readFile(result.asset, 'utf8');
        const features = content.trim().split('\n').map((l) => JSON.parse(l));

        assert.ok(features.length > 0, 'should produce at least one feature');

        for (const feat of features) {
            assert.strictEqual(feat.type, 'Feature');
            assert.ok(feat.geometry, 'feature should have geometry');
            assert.strictEqual(feat.geometry.type, 'Point');
        }
    });

    await fs.promises.rm(tmpdir, { recursive: true, force: true });
});

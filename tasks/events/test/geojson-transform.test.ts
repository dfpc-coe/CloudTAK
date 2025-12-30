import test from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import fs from 'node:fs';
import GeoJSON from '../src/transforms/geojson.js';
import type { Message, LocalMessage } from '../src/types.js';

test('GeoJSON Transform', async (t) => {
    const tmpdir = await fs.promises.mkdtemp('/tmp/geojson-test-');
    
    await t.test('Convert FeatureCollection to Line Delimited', async () => {
        const id = 'input';
        const ext = '.json';
        const inputFile = path.join(tmpdir, id + ext);
        const featureCollection = {
            type: 'FeatureCollection',
            features: [
                { type: 'Feature', properties: { a: 1 }, geometry: null },
                { type: 'Feature', properties: { b: 2 }, geometry: null }
            ]
        };
        await fs.promises.writeFile(inputFile, JSON.stringify(featureCollection));

        const transform = new GeoJSON({} as Message, {
            tmpdir,
            name: 'input.json',
            ext,
            id,
            raw: inputFile
        } as LocalMessage);

        const result = await transform.convert();
        
        const content = await fs.promises.readFile(result.asset, 'utf8');
        const lines = content.trim().split('\n');
        assert.strictEqual(lines.length, 2);
        assert.deepStrictEqual(JSON.parse(lines[0]), featureCollection.features[0]);
        assert.deepStrictEqual(JSON.parse(lines[1]), featureCollection.features[1]);
    });

    await t.test('Convert Single Feature to Line Delimited', async () => {
        const id = 'single';
        const ext = '.json';
        const inputFile = path.join(tmpdir, id + ext);
        const feature = { type: 'Feature', properties: { a: 1 }, geometry: null };
        await fs.promises.writeFile(inputFile, JSON.stringify(feature));

        const transform = new GeoJSON({} as Message, {
            tmpdir,
            name: 'single.json',
            ext,
            id,
            raw: inputFile
        } as LocalMessage);

        const result = await transform.convert();
        
        const content = await fs.promises.readFile(result.asset, 'utf8');
        const lines = content.trim().split('\n');
        assert.strictEqual(lines.length, 1);
        assert.deepStrictEqual(JSON.parse(lines[0]), feature);
    });

    await t.test('Pass through Line Delimited', async () => {
        const id = 'lines';
        const ext = '.geojsonld';
        const inputFile = path.join(tmpdir, id + ext);
        const feature1 = { type: 'Feature', properties: { a: 1 }, geometry: null };
        const feature2 = { type: 'Feature', properties: { b: 2 }, geometry: null };
        await fs.promises.writeFile(inputFile, JSON.stringify(feature1) + '\n' + JSON.stringify(feature2) + '\n');

        const transform = new GeoJSON({} as Message, {
            tmpdir,
            name: 'lines.geojsonld',
            ext,
            id,
            raw: inputFile
        } as LocalMessage);

        const result = await transform.convert();
        
        const content = await fs.promises.readFile(result.asset, 'utf8');
        const lines = content.trim().split('\n');
        assert.strictEqual(lines.length, 2);
        assert.deepStrictEqual(JSON.parse(lines[0]), feature1);
        assert.deepStrictEqual(JSON.parse(lines[1]), feature2);
    });

    await fs.promises.rm(tmpdir, { recursive: true, force: true });
});

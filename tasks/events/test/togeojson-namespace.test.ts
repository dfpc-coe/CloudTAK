import test, { type TestContext } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs/promises';
import path from 'node:path';
import { kml } from '../src/togeojson/index.js';
import KML from '../src/transforms/kml.js';
import type { Message, LocalMessage } from '../src/types.js';

/**
 * ArcGIS "Layer To KML" exports reference the xsi: prefix in
 * xsi:schemaLocation on the Document element without ever declaring
 * xmlns:xsi. Google Earth tolerates this but DOM parsers reject it as
 * malformed ("NamespaceError: prefix is non-null and namespace is null"),
 * which used to fail the whole import. The xml-js based togeojson port
 * treats prefixes as part of the node name, so these files convert.
 */

const ARCGIS_KML = new URL('./fixtures/arcgis-undeclared-xsi.kml', import.meta.url);

test('KML with undeclared namespace prefixes', async (t) => {
    await t.test('ArcGIS xsi:schemaLocation without xmlns:xsi converts', async () => {
        const content = await fs.readFile(ARCGIS_KML, 'utf8');
        const res = kml(content);

        assert.equal(res.features.length, 2);

        assert.equal(res.features[0].id, 'ID_00000');
        assert.equal(res.features[0].properties?.name, 'AT&T Mobility LLC');
        assert.deepStrictEqual(res.features[0].geometry, {
            type: 'Point',
            coordinates: [-105.3696111113433, 38.12761110994916, 0],
        });

        // Shared styles still resolve
        assert.equal(res.features[0].properties?.styleUrl, '#IconStyle00');
        assert.equal(res.features[0].properties?.icon, 'Layer0_Symbol_74ad4c34_0.png');
        assert.equal(res.features[1].properties?.name, 'Verizon Wireless');
    });

    await t.test('undeclared prefixes on elements are tolerated', () => {
        const res = kml(`<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
    <Placemark>
        <name>tolerant</name>
        <mystery:extension>ignored</mystery:extension>
        <Point><coordinates>-105.1,40.1,0</coordinates></Point>
    </Placemark>
</kml>`);

        assert.equal(res.features.length, 1);
        assert.equal(res.features[0].properties?.name, 'tolerant');
    });
});

test('KML Transform - ArcGIS undeclared xsi namespace', async (t: TestContext) => {
    const tmpdir = await fs.mkdtemp('/tmp/kml-test-');
    t.after(() => fs.rm(tmpdir, { recursive: true, force: true }));

    const raw = path.join(tmpdir, 'test.kml');
    await fs.copyFile(ARCGIS_KML, raw);

    const transform = new KML(
        {} as Message,
        {
            tmpdir,
            name: 'test.kml',
            ext: '.kml',
            id: 'test',
            raw,
        } as LocalMessage,
    );

    const result = await transform.convert();

    const lines = (await fs.readFile(result.asset, 'utf8')).trim().split('\n').filter(Boolean);
    const features = lines.map(l => JSON.parse(l));

    assert.equal(features.length, 2);
    assert.deepStrictEqual(features.map(f => f.properties?.name), [
        'AT&T Mobility LLC',
        'Verizon Wireless',
    ]);
});

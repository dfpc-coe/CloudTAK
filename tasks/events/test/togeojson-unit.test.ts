import test from 'node:test';
import assert from 'node:assert';
import { fixColor } from '../src/togeojson/kml/fixColor.js';
import { coord, coord1, fixRing } from '../src/togeojson/kml/geometry.js';
import { extractStyle } from '../src/togeojson/kml/extractStyle.js';
import { childElements, parseXml } from '../src/togeojson/xml.js';

/**
 * Migrated from @tmcw/togeojson v7.1.2:
 * lib/kml/fixColor.test.ts, lib/kml/geometry.test.ts, lib/kml/extractStyle.test.ts
 */

test('fixColor', async (t) => {
    await t.test('passes-through CSS colors', () => {
        assert.deepStrictEqual(fixColor('#f00', 'line'), {
            'line-color': '#f00',
        });
        assert.deepStrictEqual(fixColor('#f00f00', 'line'), {
            'line-color': '#f00f00',
        });
    });

    await t.test('rearranges KML colors', () => {
        assert.deepStrictEqual(fixColor('#000f0000', 'line'), {
            'line-color': '#00000f',
            'line-opacity': 0,
        });
        assert.deepStrictEqual(fixColor('#ff000000', 'line'), {
            'line-color': '#000000',
            'line-opacity': 1,
        });
        assert.deepStrictEqual(fixColor('ff000000', 'line'), {
            'line-color': '#000000',
            'line-opacity': 1,
        });
        assert.deepStrictEqual(fixColor('#a1ff00ff', 'line'), {
            'line-color': '#ff00ff',
            'line-opacity': 0.6313725490196078,
        });
    });
});

test('coord1', async (t) => {
    await t.test('parses a coordinate', () => {
        assert.deepStrictEqual(coord1('42,24'), [42, 24]);
        assert.deepStrictEqual(coord1('2,2'), [2, 2]);
        assert.deepStrictEqual(coord1('2,2,4'), [2, 2, 4]);
    });

    await t.test('removes nans', () => {
        assert.deepStrictEqual(coord1('a,24'), [24]);
    });
});

test('coord', async (t) => {
    await t.test('parses coordinates', () => {
        assert.deepStrictEqual(coord('42,24 1,2'), [
            [42, 24],
            [1, 2],
        ]);
        assert.deepStrictEqual(coord('42,24 1,2 alpha,beta'), [
            [42, 24],
            [1, 2],
        ]);
    });
});

test('fixRing', async (t) => {
    await t.test('completes a ring if necessary', () => {
        assert.deepStrictEqual(
            fixRing([
                [1, 2],
                [3, 4],
                [5, 6],
            ]),
            [
                [1, 2],
                [3, 4],
                [5, 6],
                [1, 2],
            ],
        );
    });

    await t.test('does not touch good rings', () => {
        assert.deepStrictEqual(
            fixRing([
                [1, 2],
                [3, 4],
                [5, 6],
                [1, 2],
            ]),
            [
                [1, 2],
                [3, 4],
                [5, 6],
                [1, 2],
            ],
        );
    });
});

function parseFragment(xml: string) {
    return childElements(parseXml(xml))[0];
}

test('extractStyle', async (t) => {
    await t.test('extracts a full style', () => {
        assert.deepStrictEqual(
            extractStyle(
                parseFragment(`<Style>
<IconStyle>
<Icon>
<href>https://earth.google.com/earth/rpc/cc/icon?color=1976d2&amp;id=2000&amp;scale=4</href>
</Icon>
<hotSpot x="64" y="128" xunits="pixels" yunits="insetPixels"/>
</IconStyle>
<LabelStyle>
</LabelStyle>
<LineStyle>
<color>ff9f3f30</color>
<width>2.13333</width>
</LineStyle>
<PolyStyle>
<color>4058eeff</color>
</PolyStyle>
<BalloonStyle>
<displayMode>hide</displayMode>
</BalloonStyle>
</Style>`),
            ),
            {
                'fill': '#ffee58',
                'fill-opacity': 0.25098039215686274,
                'icon': 'https://earth.google.com/earth/rpc/cc/icon?color=1976d2&id=2000&scale=4',
                'icon-offset': [64, 128],
                'icon-offset-units': ['pixels', 'insetPixels'],
                'stroke': '#303f9f',
                'stroke-opacity': 1,
                'stroke-width': 2.13333,
            },
        );
    });

    await t.test('extracts icon color and scale', () => {
        assert.deepStrictEqual(
            extractStyle(
                parseFragment(`<Style>
      <IconStyle>
        <color>ffd18802</color>
        <scale>1</scale>
        <Icon>
          <href>https://www.gstatic.com/mapspro/images/stock/503-wht-blank_maps.png</href>
        </Icon>
        <hotSpot x="32" xunits="pixels" y="64" yunits="insetPixels"/>
      </IconStyle>
      <LabelStyle>
        <scale>0</scale>
      </LabelStyle>
      <BalloonStyle>
        <text><![CDATA[<h3>$[name]</h3>]]></text>
      </BalloonStyle>
    </Style>`),
            ),
            {
                'icon': 'https://www.gstatic.com/mapspro/images/stock/503-wht-blank_maps.png',
                'icon-color': '#0288d1',
                'icon-offset': [32, 64],
                'icon-offset-units': ['pixels', 'insetPixels'],
                'icon-opacity': 1,
                'icon-scale': 1,
                'label-scale': 0,
            },
        );
    });
});

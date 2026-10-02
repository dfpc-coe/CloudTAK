import { describe, expect, it } from 'vitest';
import { createExpression, featureFilter } from '@maplibre/maplibre-gl-style-spec';
import type { SymbolLayerSpecification } from 'maplibre-gl';
import type { Feature } from '../types.ts';
import COT, { renderedIcon, renderedIconImage } from './cot.ts';
import styles from '../utils/styles.ts';

const SIDC = '13061500000000000000';

function properties(props: Partial<Feature['properties']>): Feature['properties'] {
    return { type: 'a-f-G', ...props } as Feature['properties'];
}

describe('renderedIcon', () => {
    it('derives a MIL-STD key from a SIDC type', () => {
        expect(renderedIcon(properties({ type: SIDC }))).toEqual(`2525E:${SIDC}`);
    });

    it('prefers the milicon over the type', () => {
        expect(renderedIcon(properties({
            type: 'a-f-G',
            milicon: { id: SIDC }
        }))).toEqual(`2525E:${SIDC}`);
    });

    it('prefers a user specified Iconset icon over the derived symbol', () => {
        expect(renderedIcon(properties({
            type: SIDC,
            icon: 'f7f71666-8b28-4b57-9fbb-e38e61d33b79:Vehicle/Ambulance.png'
        }))).toEqual('f7f71666-8b28-4b57-9fbb-e38e61d33b79:Vehicle/Ambulance.png');
    });

    it('falls back to the CoT Type for a non MIL-STD Feature', () => {
        expect(renderedIcon(properties({ type: 'a-f-G-U-C-I' }))).toEqual('a-f-G-U-C-I');
    });

    it('returns nothing for Types with no spritesheet icon', () => {
        expect(renderedIcon(properties({ type: 'u-d-p' }))).toBeUndefined();
        expect(renderedIcon(properties({ type: 'b-m-p-s-m' }))).toBeUndefined();
    });

    // The skittle & icon map layers filter on `group`/`icon` independently, so a
    // derived icon here renders a symbol on top of the Contact's skittle
    it('derives nothing for a Contact so only the skittle renders', () => {
        expect(renderedIcon(properties({
            type: SIDC,
            group: { name: 'Cyan', role: 'Team Member' }
        }))).toBeUndefined();

        expect(renderedIcon(properties({
            type: 'a-f-G-U-C-I',
            group: { name: 'Cyan', role: 'Team Member' }
        }))).toBeUndefined();
    });
});

describe('renderedIconImage', () => {
    const ICONSET = 'f7f71666-8b28-4b57-9fbb-e38e61d33b79:Vehicle/Ambulance';

    it('is the rendered icon when there is no marker-color', () => {
        expect(renderedIconImage(properties({ type: 'a-f-G-U-C-I' }))).toEqual('a-f-G-U-C-I');
        expect(renderedIconImage(properties({ icon: ICONSET }))).toEqual(ICONSET);
    });

    it('requests the marker-color variant of a spritesheet or Iconset icon', () => {
        expect(renderedIconImage(properties({
            type: 'a-f-G-U-C-I',
            'marker-color': '#00FF00'
        }))).toEqual('a-f-G-U-C-I-colored-00FF00');

        expect(renderedIconImage(properties({
            icon: ICONSET,
            'marker-color': '#ff0000'
        }))).toEqual(`${ICONSET}-colored-ff0000`);
    });

    it('never recolours a MIL-STD symbol', () => {
        expect(renderedIconImage(properties({
            type: SIDC,
            'marker-color': '#00FF00'
        }))).toEqual(`2525E:${SIDC}`);
    });

    it('is nothing when there is no icon', () => {
        expect(renderedIconImage(properties({ type: 'u-d-p', 'marker-color': '#00FF00' }))).toBeUndefined();
        expect(renderedIconImage(properties({
            type: 'a-f-G-U-C-I',
            'marker-color': '#00FF00',
            group: { name: 'Cyan', role: 'Team Member' }
        }))).toBeUndefined();
    });

    // The map style can't call renderedIconImage - it has its own expression
    // that must request the very same image id for the same Feature
    describe('agrees with the icon layer', () => {
        const layer = styles('test', { icons: true })
            .find((l) => l.id === 'test-icon') as SymbolLayerSpecification;

        const filter = featureFilter(layer.filter!, 'layers[0].filter');
        const image = createExpression(layer.layout!['icon-image'], 'layers[0].layout.icon-image');
        if (image.result === 'error') throw new Error(JSON.stringify(image.value));
        const expression = image.value;

        const globals = { zoom: 10 };

        function mapImage(props: Feature['properties']): string | undefined {
            const rendered = COT.as_rendered({
                id: 'agree',
                type: 'Feature',
                properties: props,
                geometry: { type: 'Point', coordinates: [-104.99, 39.73] }
            } as Feature);

            const feature = { type: 'Point' as const, properties: rendered.properties! };

            if (!filter.filter(globals, feature)) return undefined;

            return expression.evaluate(globals, feature);
        }

        for (const [name, props] of Object.entries({
            'spritesheet icon': properties({ type: 'a-f-G-U-C-I', callsign: 'A' }),
            'coloured spritesheet icon': properties({ type: 'a-f-G-U-C-I', callsign: 'A', 'marker-color': '#00FF00' }),
            'iconset icon': properties({ type: 'a-f-G', callsign: 'A', icon: ICONSET }),
            'coloured iconset icon': properties({ type: 'a-f-G', callsign: 'A', icon: ICONSET, 'marker-color': '#123abc' }),
            'MIL-STD symbol': properties({ type: SIDC, callsign: 'A' }),
            'coloured MIL-STD symbol': properties({ type: SIDC, callsign: 'A', 'marker-color': '#00FF00' }),
            'milicon': properties({ type: 'a-f-G', callsign: 'A', milicon: { id: SIDC }, 'marker-color': '#00FF00' }),
            'iconless point': properties({ type: 'u-d-p', callsign: 'A', 'marker-color': '#00FF00' }),
            'contact': properties({ type: 'a-f-G-U-C-I', callsign: 'A', 'marker-color': '#00FFFF', group: { name: 'Cyan', role: 'Team Member' } }),
        })) {
            it(name, () => {
                expect(mapImage(props)).toEqual(renderedIconImage(props));
            });
        }
    });
});

describe('COT.styleProperties - MIL-STD icons are never stored', () => {
    it('leaves a SIDC type Feature with no icon', async () => {
        const styled = await COT.styleProperties('Point', properties({ type: SIDC }));

        expect(styled.icon).toBeUndefined();
    });

    it('leaves a milicon Feature with no icon', async () => {
        const styled = await COT.styleProperties('Point', properties({
            type: 'a-f-G',
            milicon: { id: SIDC }
        }));

        expect(styled.icon).toBeUndefined();
    });

    it('strips a render key stored by an older client', async () => {
        const styled = await COT.styleProperties('Point', properties({
            type: SIDC,
            icon: `2525E:${SIDC}`
        }));

        expect(styled.icon).toBeUndefined();
    });

    it('retains a user specified Iconset icon', async () => {
        const styled = await COT.styleProperties('Point', properties({
            type: SIDC,
            icon: 'f7f71666-8b28-4b57-9fbb-e38e61d33b79:Vehicle/Ambulance.png'
        }));

        expect(styled.icon).toEqual('f7f71666-8b28-4b57-9fbb-e38e61d33b79:Vehicle/Ambulance');
    });

    it('still stores the Type derived icon for a non MIL-STD Feature', async () => {
        const styled = await COT.styleProperties('Point', properties({ type: 'a-f-G-U-C-I' }));

        expect(styled.icon).toEqual('a-f-G-U-C-I');
    });
});

describe('COT.as_rendered', () => {
    it('supplies the MIL-STD key the map style keys icon-image off', () => {
        const rendered = COT.as_rendered({
            id: 'render-test',
            type: 'Feature',
            properties: properties({ type: SIDC, callsign: 'Test' }),
            geometry: { type: 'Point', coordinates: [-104.99, 39.73] }
        } as Feature);

        expect(rendered.properties!.icon).toEqual(`2525E:${SIDC}`);
    });

    it('leaves a Contact iconless so the skittle layer owns it', () => {
        const rendered = COT.as_rendered({
            id: 'render-contact',
            type: 'Feature',
            properties: properties({
                type: SIDC,
                callsign: 'Test',
                group: { name: 'Cyan', role: 'Team Member' }
            }),
            geometry: { type: 'Point', coordinates: [-104.99, 39.73] }
        } as Feature);

        expect(rendered.properties!.icon).toBeUndefined();
    });

    // marker-stroke-color must survive as_rendered()
    it('carries marker-stroke-color through to the rendered Feature', () => {
        const rendered = COT.as_rendered({
            id: 'render-contact-stroke',
            type: 'Feature',
            properties: properties({
                type: 'a-f-G-U-C-I',
                callsign: 'Test',
                group: { name: 'Cyan', role: 'Team Member' },
                'marker-color': '#00FFFF',
                'marker-stroke-color': '#000000'
            }),
            geometry: { type: 'Point', coordinates: [-104.99, 39.73] }
        } as Feature);

        expect(rendered.properties!['marker-stroke-color']).toEqual('#000000');
    });
});

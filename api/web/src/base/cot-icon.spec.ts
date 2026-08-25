import { describe, expect, it } from 'vitest';
import type { Feature } from '../types.ts';
import COT, { renderedIcon } from './cot.ts';

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
});

describe('COT.as_rendered elevation', () => {
    const render = (coordinates: number[]) => COT.as_rendered({
        id: 'render-elevation',
        type: 'Feature',
        properties: properties({ type: SIDC, callsign: 'Test' }),
        geometry: { type: 'Point', coordinates }
    } as Feature);

    it('passes a valid HAE through as elevation', () => {
        expect(render([-104.99, 39.73, 1609.3]).properties!.elevation).toEqual(1609.3);
    });

    it('omits elevation when the HAE is missing, zero, or the TAK unknown sentinel', () => {
        expect(render([-104.99, 39.73]).properties!.elevation).toBeUndefined();
        expect(render([-104.99, 39.73, 0]).properties!.elevation).toBeUndefined();
        expect(render([-104.99, 39.73, 9999999]).properties!.elevation).toBeUndefined();
        expect(render([-104.99, 39.73, NaN]).properties!.elevation).toBeUndefined();
    });
});

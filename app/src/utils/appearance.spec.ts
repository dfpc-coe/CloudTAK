import { describe, expect, it } from 'vitest';
import type { Feature } from '../types.ts';
import {
    affiliationOf,
    withAffiliation,
    statusOf,
    withStatus,
    markerOf,
    symbolCode,
    splitTypeName,
    draftFrom,
    applyAppearance,
    describeAppearance,
    styleFrom,
    applyStyle,
    describeStyle,
    contextOf,
    withContext,
    hqTfDummyOf,
    withHqTfDummy,
    hqTfDummyOptions,
    amplifierOf,
    withAmplifier,
    amplifierOptions,
    carryFrame,
} from './appearance.ts';

const INFANTRY_E = '13061000001211000000';

function properties(props: Partial<Feature['properties']>): Feature['properties'] {
    return { type: 'u-d-p', callsign: 'Test', center: [0, 0] as number[], ...props } as unknown as Feature['properties'];
}

describe('affiliation', () => {
    it('reads the affiliation of CoT types and SIDCs', () => {
        expect(affiliationOf('a-h-G-U-C-I')).toEqual('h');
        expect(affiliationOf('a-f-G')).toEqual('f');
        expect(affiliationOf(INFANTRY_E)).toEqual('h');
        expect(affiliationOf('u-d-p')).toBeUndefined();
        expect(affiliationOf('b-m-p-s-m')).toBeUndefined();
    });

    it('swaps the affiliation of CoT types and SIDCs', () => {
        expect(withAffiliation('a-h-G-U-C-I', 'f')).toEqual('a-f-G-U-C-I');
        expect(withAffiliation('a-h-G', 'n')).toEqual('a-n-G');
        expect(withAffiliation(INFANTRY_E, 'f')).toEqual('13031000001211000000');
        expect(withAffiliation('u-d-p', 'f')).toEqual('u-d-p');
    });

    it('keeps the context when swapping affiliation', () => {
        const exercise = withContext(INFANTRY_E, '1');
        expect(affiliationOf(exercise)).toEqual('h');
        expect(withAffiliation(exercise, 'f')).toEqual('13131000001211000000');
    });
});

describe('status', () => {
    it('reads and writes the 2525E status digit', () => {
        expect(statusOf(INFANTRY_E)).toEqual('0');
        expect(withStatus(INFANTRY_E, '3')).toEqual('13061030001211000000');
        expect(statusOf('13061030001211000000')).toEqual('3');
        expect(statusOf('a-h-G-U-C-I')).toEqual('0');
        expect(withStatus('a-h-G-U-C-I', '3')).toEqual('a-h-G-U-C-I');
    });
});

describe('marker', () => {
    it('classifies how a Feature is drawn', () => {
        expect(markerOf({ type: 'u-d-p' })).toEqual('dot');
        expect(markerOf({ type: 'a-h-G-U-C-I' })).toEqual('symbol');
        expect(markerOf({ type: 'a-h-G-U-C-I', icon: 'a-h-G-U-C-I' })).toEqual('symbol');
        expect(markerOf({ type: INFANTRY_E })).toEqual('symbol');
        expect(markerOf({ type: INFANTRY_E, icon: 'abc:Incident/Fire' })).toEqual('icon');
        expect(markerOf({ type: 'u-d-p', icon: 'abc:Incident/Fire' })).toEqual('icon');
    });
});

describe('symbolCode', () => {
    it('returns the SIDC or 2525B code', () => {
        expect(symbolCode(INFANTRY_E)).toEqual(INFANTRY_E);
        expect(symbolCode('a-h-G-U-C-I')).toMatch(/^SHGPUCI/);
        expect(symbolCode('u-d-p')).toBeUndefined();
    });
});

describe('splitTypeName', () => {
    it('splits 2525B slash paths', () => {
        expect(splitTypeName('a-h-G-U-C-I', 'Gnd/Combat/Infantry/Troops (Open)')).toEqual({
            title: 'Troops (Open)',
            path: ['Gnd', 'Combat', 'Infantry']
        });
    });

    it('prefixes 2525E names with their symbol set', () => {
        expect(splitTypeName(INFANTRY_E, 'Infantry - Mechanized')).toEqual({
            title: 'Mechanized',
            path: ['Land units', 'Infantry']
        });
    });

    it('falls back to the type', () => {
        expect(splitTypeName('a-h-G-U-C-I', 'a-h-G-U-C-I')).toEqual({ title: 'a-h-G-U-C-I', path: [] });
        expect(splitTypeName('a-h-G', undefined)).toEqual({ title: 'a-h-G', path: [] });
    });
});

describe('draftFrom', () => {
    it('reads an untyped point', () => {
        expect(draftFrom(properties({ type: 'u-d-p', 'marker-color': '#FF4D4D' }))).toEqual({
            type: undefined,
            affiliation: 'u',
            marker: 'dot',
            icon: undefined,
            color: '#FF4D4D',
            opacity: 1
        });
    });

    it('reads a custom icon on a typed point', () => {
        expect(draftFrom(properties({ type: INFANTRY_E, icon: 'abc:Incident/Fire', 'marker-color': '#FF8C1A' }))).toEqual({
            type: INFANTRY_E,
            affiliation: 'h',
            marker: 'icon',
            icon: 'abc:Incident/Fire',
            color: '#FF8C1A',
            opacity: 1
        });
    });
});

describe('applyAppearance', () => {
    it('types a dot as a MIL-STD symbol', () => {
        const next = applyAppearance(properties({ type: 'u-d-p', 'marker-color': '#FF4D4D' }), {
            type: INFANTRY_E,
            affiliation: 'h',
            marker: 'symbol',
            color: '#FF4D4D',
            opacity: 1
        });

        expect(next.type).toEqual(INFANTRY_E);
        expect(next.icon).toBeUndefined();
        expect(next.milicon).toBeUndefined();
        expect(next['marker-color']).toEqual('#FFFFFF');
    });

    it('keeps the spritesheet icon for a 2525B type', () => {
        const next = applyAppearance(properties({ type: 'a-f-G', milicon: { id: INFANTRY_E } }), {
            type: 'a-h-G-U-C-I',
            affiliation: 'h',
            marker: 'symbol',
            color: '#FFFFFF',
            opacity: 1
        });

        expect(next.type).toEqual('a-h-G-U-C-I');
        expect(next.icon).toEqual('a-h-G-U-C-I');
        expect(next.milicon).toBeUndefined();
    });

    it('leaves an untyped symbol as a dot', () => {
        const next = applyAppearance(properties({ type: 'u-d-p' }), {
            affiliation: 'h',
            marker: 'symbol',
            color: '#FFFFFF',
            opacity: 1
        });

        expect(next.type).toEqual('u-d-p');
        expect(next.icon).toBeUndefined();
    });

    it('keeps the type under a custom icon', () => {
        const next = applyAppearance(properties({ type: INFANTRY_E }), {
            type: INFANTRY_E,
            affiliation: 'h',
            marker: 'icon',
            icon: 'abc:Incident/Fire',
            color: '#FF8C1A',
            opacity: 1
        });

        expect(next.type).toEqual(INFANTRY_E);
        expect(next.icon).toEqual('abc:Incident/Fire');
        expect(next['marker-color']).toEqual('#FF8C1A');
    });

    it('falls back to the symbol when no icon was picked', () => {
        const next = applyAppearance(properties({ type: INFANTRY_E }), {
            type: INFANTRY_E,
            affiliation: 'h',
            marker: 'icon',
            color: '#FF8C1A',
            opacity: 1
        });

        expect(next.icon).toBeUndefined();
        expect(next['marker-color']).toEqual('#FFFFFF');
    });

    it('drops the type for a dot', () => {
        const next = applyAppearance(properties({ type: INFANTRY_E, icon: 'abc:Incident/Fire' }), {
            type: INFANTRY_E,
            affiliation: 'h',
            marker: 'dot',
            icon: 'abc:Incident/Fire',
            color: '#4D8CFF',
            opacity: 1
        });

        expect(next.type).toEqual('u-d-p');
        expect(next.icon).toBeUndefined();
        expect(next['marker-color']).toEqual('#4D8CFF');
    });
});

describe('describeAppearance', () => {
    it('summarises a MIL-STD symbol', () => {
        expect(describeAppearance(properties({ type: INFANTRY_E }), 'Infantry')).toEqual({
            title: 'Hostile · Infantry',
            subtitle: 'Military symbol · red from Hostile'
        });
    });

    it('summarises a custom icon', () => {
        expect(describeAppearance(properties({ type: INFANTRY_E, icon: 'abc:Incident/Fire' }), 'Infantry', 'Fire (Incident)')).toEqual({
            title: 'Hostile · Infantry',
            subtitle: 'Custom icon · Fire (Incident)'
        });
    });

    it('summarises an untyped dot', () => {
        expect(describeAppearance(properties({ type: 'u-d-p', 'marker-color': '#FFD21A' }))).toEqual({
            title: 'Unknown point',
            subtitle: 'Dot · Yellow'
        });
    });
});

describe('style', () => {
    it('reads defaults for an unstyled polygon', () => {
        expect(styleFrom(properties({ type: 'u-d-f', stroke: '#FF4D4D' }))).toEqual({
            stroke: '#FF4D4D',
            strokeStyle: 'solid',
            strokeWidth: 1,
            strokeOpacity: 1,
            fill: '#FF4D4D',
            fillOpacity: 1
        });
    });

    it('writes fill only for polygons', () => {
        const style = { stroke: '#4D8CFF', strokeStyle: 'dashed', strokeWidth: 3, strokeOpacity: 0.5, fill: '#FFD21A', fillOpacity: 0.2 };

        const line = applyStyle(properties({ type: 'u-d-f' }), 'LineString', style);
        expect(line.stroke).toEqual('#4D8CFF');
        expect(line['stroke-style']).toEqual('dashed');
        expect(line['stroke-width']).toEqual(3);
        expect(line.fill).toBeUndefined();

        const polygon = applyStyle(properties({ type: 'u-d-f' }), 'Polygon', style);
        expect(polygon.fill).toEqual('#FFD21A');
        expect(polygon['fill-opacity']).toEqual(0.2);
    });

    it('summarises stroke and fill', () => {
        expect(describeStyle('Polygon', properties({ type: 'u-d-f', stroke: '#FF4D4D', fill: '#4D8CFF' }))).toEqual({
            title: 'Polygon',
            subtitle: 'Stroke Red · Fill Blue'
        });
        expect(describeStyle('LineString', properties({ type: 'b-m-r', stroke: '#FFFFFF', 'stroke-style': 'dashed' }))).toEqual({
            title: 'Route',
            subtitle: 'Stroke White · dashed'
        });
    });
});

describe('frame fields', () => {
    it('reads and writes the context digit', () => {
        expect(contextOf(INFANTRY_E)).toEqual('0');
        expect(withContext(INFANTRY_E, '2')).toEqual('13261000001211000000');
        expect(contextOf('13261000001211000000')).toEqual('2');
        expect(withContext('a-h-G', '1')).toEqual('a-h-G');
    });

    it('packs HQ / task force / dummy into one digit', () => {
        const hqtf = withHqTfDummy(INFANTRY_E, { headquarters: true, taskForce: true, dummy: false });
        expect(hqtf).toEqual('13061006001211000000');
        expect(hqTfDummyOf(hqtf)).toEqual({ headquarters: true, taskForce: true, dummy: false });
        expect(hqTfDummyOf(withHqTfDummy(INFANTRY_E, { headquarters: false, taskForce: false, dummy: true }))).toEqual({
            headquarters: false, taskForce: false, dummy: true
        });
        expect(hqTfDummyOf('a-h-G')).toEqual({ headquarters: false, taskForce: false, dummy: false });
    });

    it('offers indicators and amplifiers per symbol set', () => {
        expect(hqTfDummyOptions('10')).toEqual(['headquarters', 'taskForce', 'dummy']);
        expect(hqTfDummyOptions('15')).toEqual(['dummy']);
        expect(hqTfDummyOptions('40')).toEqual([]);
        expect(amplifierOptions('10')?.label).toEqual('Echelon');
        expect(amplifierOptions('15')?.label).toEqual('Mobility');
        expect(amplifierOptions('35')?.label).toEqual('Towed array');
        expect(amplifierOptions('40')).toBeUndefined();
    });

    it('reads and writes the amplifier digits', () => {
        const platoon = withAmplifier(INFANTRY_E, '14');
        expect(platoon).toEqual('13061000141211000000');
        expect(amplifierOf(platoon)).toEqual('14');
        expect(amplifierOf('a-h-G')).toEqual('00');
    });

    it('carries frame fields onto a newly picked symbol', () => {
        const from = withAmplifier(withHqTfDummy(withStatus(withContext(INFANTRY_E, '1'), '3'), { headquarters: true, taskForce: false, dummy: false }), '16');
        const sameSet = '13061000001212000000';
        const otherSet = '13061500001101000000';

        expect(carryFrame(from, sameSet)).toEqual('13161032161212000000');
        expect(carryFrame(from, otherSet)).toEqual('13161500001101000000');
        expect(carryFrame(undefined, sameSet)).toEqual(sameSet);
        expect(carryFrame('a-h-G-U-C-I', sameSet)).toEqual(sameSet);
    });
});

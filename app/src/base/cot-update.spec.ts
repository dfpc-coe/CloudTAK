import { describe, expect, it } from 'vitest';
import type { Feature } from '../types.ts';
import COT, { OriginMode, renderedIcon } from './cot.ts';

const SIDC_A = '13061500000000000000';
const SIDC_B = '13031000001101000000';

function cot(props: Partial<Feature['properties']>): COT {
    return new COT({
        id: 'test-cot',
        type: 'Feature',
        properties: { id: 'test-cot', type: 'a-f-G', ...props },
        geometry: { type: 'Point', coordinates: [0, 0] }
    } as Feature, { mode: OriginMode.MISSION }, { skipSave: true });
}

function full(c: COT, props: Partial<Feature['properties']>): Feature['properties'] {
    const properties = JSON.parse(JSON.stringify(c.properties)) as Feature['properties'];
    delete properties.milicon;
    delete properties.icon;
    return { ...properties, ...props };
}

describe('COT.update type changes', () => {
    it('re-renders a SIDC to SIDC change with no other rendered property change', async () => {
        const c = cot({ type: SIDC_A });

        const changed = await c.update({ properties: full(c, { type: SIDC_B }) });

        expect(changed).toBe(true);
        expect(renderedIcon(c.properties)).toEqual(`2525E:${SIDC_B}`);
    });

    it('drops a stale milicon when the type changes', async () => {
        const c = cot({ type: 'a-f-G', milicon: { id: SIDC_A } });
        expect(renderedIcon(c.properties)).toEqual(`2525E:${SIDC_A}`);

        const changed = await c.update({ properties: full(c, { type: SIDC_B }) });

        expect(changed).toBe(true);
        expect(c.properties.milicon).toBeUndefined();
        expect(renderedIcon(c.properties)).toEqual(`2525E:${SIDC_B}`);
    });

    it('drops a stale type-derived icon when changing to a SIDC', async () => {
        const c = cot({ type: 'a-f-G-U-C', icon: 'a-f-G-U-C' });

        const changed = await c.update({ properties: full(c, { type: SIDC_B }) });

        expect(changed).toBe(true);
        expect(c.properties.icon).toBeUndefined();
        expect(renderedIcon(c.properties)).toEqual(`2525E:${SIDC_B}`);
    });

    it('keeps a user picked Iconset icon across a type change', async () => {
        const icon = 'f7f71666-8b28-4b57-9fbb-e38e61d33b79:Vehicle/Ambulance';
        const c = cot({ type: 'a-f-G-U-C', icon });

        await c.update({ properties: { ...full(c, { type: SIDC_B }), icon } });

        expect(renderedIcon(c.properties)).toEqual(icon);
    });

    it('does not flag a change when the type is unchanged', async () => {
        const c = cot({ type: SIDC_A });

        const changed = await c.update({ properties: full(c, { remarks: 'Updated' }) });

        expect(changed).toBe(false);
        expect(renderedIcon(c.properties)).toEqual(`2525E:${SIDC_A}`);
    });
});

describe('COT.update icon removal', () => {
    it('drops a user picked Iconset icon when the update omits it', async () => {
        const icon = 'f7f71666-8b28-4b57-9fbb-e38e61d33b79:Vehicle/Ambulance';
        const c = cot({ type: 'u-d-p', icon });
        expect(renderedIcon(c.properties)).toEqual(icon);

        // The main thread serialises `icon: undefined` away before the
        // worker applies the update, so the key is simply absent
        const changed = await c.update({ properties: full(c, {}) });

        expect(changed).toBe(true);
        expect(c.properties.icon).toBeUndefined();
        expect(renderedIcon(c.properties)).toBeUndefined();
    });

    it('falls back to the MIL-STD symbol when a SIDC feature drops its icon', async () => {
        const icon = 'f7f71666-8b28-4b57-9fbb-e38e61d33b79:Vehicle/Ambulance';
        const c = cot({ type: SIDC_A, icon });

        await c.update({ properties: full(c, {}) });

        expect(c.properties.icon).toBeUndefined();
        expect(renderedIcon(c.properties)).toEqual(`2525E:${SIDC_A}`);
    });
});

describe('COT.update sensor changes', () => {
    const sensor = { azimuth: 90, fov: 60, range: 100 };

    it('re-renders when a sensor first arrives', async () => {
        const c = cot({});
        expect(c.as_derived()).toEqual([]);

        const changed = await c.update({ properties: full(c, { sensor }) });

        expect(changed).toBe(true);
        expect(c.as_derived()).toHaveLength(1);
    });

    it('re-renders when the sensor changes and not when it is repeated', async () => {
        const c = cot({ sensor });
        // The first update also applies style defaults & a centre
        await c.update({ properties: full(c, {}) });

        expect(await c.update({ properties: full(c, { sensor: { ...sensor } }) })).toBe(false);
        expect(await c.update({ properties: full(c, { sensor: { ...sensor, azimuth: 180 } }) })).toBe(true);
        expect(c.properties.sensor?.azimuth).toEqual(180);
    });

    it('drops the sensor when an update omits it', async () => {
        const c = cot({ sensor });
        expect(c.as_derived()).toHaveLength(1);

        const properties = full(c, {});
        delete properties.sensor;
        const changed = await c.update({ properties });

        expect(changed).toBe(true);
        expect(c.properties.sensor).toBeUndefined();
        expect(c.as_derived()).toEqual([]);
    });
});

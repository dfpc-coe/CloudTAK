import { describe, expect, it } from 'vitest';
import { entityLink, entityLabel, entityRoute, entityRouteName, entityMarkerProperties } from './core-entity.ts';

const EVENT = '0ed16b9e-a0c8-480f-8860-284b9afb2b1d';
const DEVICE = '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d';

describe('entityLink', () => {
    it('returns nothing without links', () => {
        expect(entityLink(undefined)).toBeUndefined();
        expect(entityLink([])).toBeUndefined();
    });

    it('ignores links that are not Core Entity parents', () => {
        expect(entityLink([
            { type: 'b-m-p-s-p-loc', uid: 'abc', relation: 'p-p' } as Record<string, string>,
            { type: 'core-event' },
            { type: 'core-device' },
            { event: EVENT },
        ])).toBeUndefined();
    });

    it('resolves a Core Event parent link', () => {
        expect(entityLink([
            { relation: 'r-u', url: 'https://example.com' } as Record<string, string>,
            { type: 'core-event', event: EVENT },
        ])).toEqual({ kind: 'event', id: EVENT });
    });

    it('resolves a Core Device parent link', () => {
        expect(entityLink([
            { type: 'core-device', device: DEVICE },
        ])).toEqual({ kind: 'device', id: DEVICE });
    });
});

describe('entity routing', () => {
    it('maps an Event', () => {
        const ref = { kind: 'event' as const, id: EVENT };
        expect(entityLabel(ref)).toBe('Event');
        expect(entityRoute(ref)).toBe(`/event/${EVENT}`);
        expect(entityRouteName(ref)).toBe('home-menu-core-entity');
    });

    it('maps a Device', () => {
        const ref = { kind: 'device' as const, id: DEVICE };
        expect(entityLabel(ref)).toBe('Device');
        expect(entityRoute(ref)).toBe(`/device/${DEVICE}`);
        expect(entityRouteName(ref)).toBe('home-menu-core-device');
    });
});

describe('entityMarkerProperties', () => {
    it('applies the Entity name, type, remarks and style to the marker', () => {
        expect(entityMarkerProperties({
            callsign: 'Old', type: 'a-f-G', remarks: '', icon: 'derived.png', 'marker-color': '#000000', stale: 'x'
        }, {
            type: '10031000001211000000',
            name: 'New',
            remarks: 'Remarks',
            style: { 'marker-opacity': 0.5 },
        })).toEqual({
            callsign: 'New',
            type: '10031000001211000000',
            remarks: 'Remarks',
            milicon: { id: '10031000001211000000' },
            'marker-opacity': 0.5,
            stale: 'x',
        });
    });

    it('keeps a pinned icon and drops a milicon for a non SIDC type', () => {
        expect(entityMarkerProperties({
            milicon: { id: '10031000001211000000' },
        }, {
            type: 'a-f-G-U-C',
            name: 'Unit',
            remarks: '',
            style: { icon: 'custom/icon.png', 'marker-color': '#ff0000' },
        })).toEqual({
            callsign: 'Unit',
            type: 'a-f-G-U-C',
            remarks: '',
            icon: 'custom/icon.png',
            'marker-color': '#ff0000',
        });
    });
});

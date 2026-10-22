import { describe, expect, it } from 'vitest';
import type { Feature } from '../types.ts';
import COT, { OriginMode } from './cot.ts';
import { derivedFeatures, sensorFootprint, sensorStyle, SENSOR_COLOR, SENSOR_FILL_OPACITY } from './cot/derived.ts';

type Sensor = NonNullable<Feature['properties']['sensor']>;

function feature(props: Partial<Feature['properties']>, coordinates: number[] = [0, 0]): Feature {
    return {
        id: 'drone',
        type: 'Feature',
        path: '/UAS',
        properties: { id: 'drone', type: 'a-f-A-M-H-Q', callsign: 'Drone', ...props },
        geometry: { type: 'Point', coordinates }
    } as Feature;
}

// Bearing & distance of a ring vertex from a [0, 0] centre
const bearing = (p: number[]) => (Math.atan2(p[0], p[1]) * 180 / Math.PI + 360) % 360;
const metres = (p: number[]) => Math.hypot(p[0], p[1]) * 111320;

describe('sensorFootprint', () => {
    it('centres the cone on the azimuth', () => {
        const poly = sensorFootprint([0, 0], { azimuth: 90, fov: 60, range: 100 });
        if (!poly) throw new Error('expected a footprint');

        const ring = poly.coordinates[0];
        expect(ring[0]).toEqual([0, 0]);
        expect(bearing(ring[1])).toBeCloseTo(60, 0);
        expect(bearing(ring[ring.length - 2])).toBeCloseTo(120, 0);
    });

    it('draws a cone pointing due north', () => {
        const poly = sensorFootprint([0, 0], { azimuth: 0, fov: 40, range: 100 });
        if (!poly) throw new Error('expected a footprint');

        const ring = poly.coordinates[0];
        expect(bearing(ring[1])).toBeCloseTo(340, 0);
        expect(bearing(ring[ring.length - 2])).toBeCloseTo(20, 0);
    });

    it('projects the slant range to the ground with the elevation', () => {
        const poly = sensorFootprint([0, 0], { azimuth: 180, fov: 30, range: 200, elevation: -60 });
        if (!poly) throw new Error('expected a footprint');

        expect(metres(poly.coordinates[0][1])).toBeCloseTo(100, 0);
    });

    it('produces nothing for a nadir, hidden or incomplete sensor', () => {
        expect(sensorFootprint([0, 0], { azimuth: 90, fov: 30, range: 200, elevation: -90 })).toBeNull();
        expect(sensorFootprint([0, 0], { azimuth: 90, fov: 30, range: 200, hideFov: true })).toBeNull();
        expect(sensorFootprint([0, 0], { fov: 30, range: 200 })).toBeNull();
        expect(sensorFootprint([0, 0], { azimuth: 90, range: 200 })).toBeNull();
        expect(sensorFootprint([0, 0], { azimuth: 90, fov: 30 })).toBeNull();
    });
});

describe('sensorStyle', () => {
    it('defaults to the soft blue', () => {
        expect(sensorStyle({ azimuth: 0 })).toEqual({ color: SENSOR_COLOR, fill: SENSOR_FILL_OPACITY, stroke: 0.7 });
    });

    it('honours the ATAK colour channels', () => {
        const style = sensorStyle({ azimuth: 0, fovRed: 1, fovGreen: 0.5, fovBlue: 0, fovAlpha: 0.3 } as Sensor);
        expect(style.color).toEqual('rgb(255,128,0)');
        expect(style.fill).toEqual(0.3);
    });
});

describe('derivedFeatures', () => {
    const sensor: Sensor = { azimuth: 45, fov: 60, range: 500 };

    it('emits nothing without a sensor', () => {
        expect(derivedFeatures(feature({}), COT.vectorId)).toEqual([]);
    });

    it('emits a sensor polygon that resolves to the parent', () => {
        const [cone, ...rest] = derivedFeatures(feature({ sensor }), COT.vectorId);

        expect(rest).toEqual([]);
        expect(cone.id).toEqual(COT.vectorId('drone.sensor'));
        expect(cone.id).not.toEqual(COT.vectorId('drone'));
        expect(cone.geometry.type).toEqual('Polygon');
        expect(cone.properties).toMatchObject({
            id: 'drone',
            path: '/UAS',
            derived: 'sensor',
            'sensor-color': SENSOR_COLOR,
            'sensor-fill-opacity': SENSOR_FILL_OPACITY
        });
    });

    it('dims with a stale parent', () => {
        const [cone] = derivedFeatures(feature({ sensor, 'marker-opacity': 0.5 }), COT.vectorId);

        expect(cone.properties['sensor-fill-opacity']).toBeCloseTo(SENSOR_FILL_OPACITY / 2);
        expect(cone.properties['sensor-stroke-opacity']).toBeCloseTo(0.35);
    });

    it('is exposed on the COT', () => {
        const c = new COT(feature({ sensor }), { mode: OriginMode.MISSION }, { skipSave: true });
        expect(c.as_derived()).toHaveLength(1);
        expect(c.as_rendered().properties.sensor).toBeUndefined();
    });
});

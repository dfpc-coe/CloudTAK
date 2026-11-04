import { sector } from '@turf/sector';
import type { Feature } from '../../types.ts';
import type {
    Feature as GeoJSONFeature,
    Geometry as GeoJSONGeometry,
    Polygon,
    Position
} from 'geojson';

/**
 * Render-only features computed from a CoT's current state - never stored,
 * never entered into the CoT store. They carry the parent's `id` so a click
 * resolves to the parent and the visibility filters apply to them unchanged
 */
export type DerivedFeature = GeoJSONFeature<GeoJSONGeometry, Record<string, unknown>>;

export const DERIVED_SENSOR = 'sensor';

export const SENSOR_COLOR = '#3b82f6';
export const SENSOR_FILL_OPACITY = 0.18;
export const SENSOR_STROKE_OPACITY = 0.7;

type SensorAttributes = NonNullable<Feature['properties']['sensor']>;

/**
 * Ground footprint of a sensor cone, centred on the azimuth. `range` is the
 * slant range so it is projected to the ground via the elevation, as ATAK does
 */
export function sensorFootprint(center: Position, sensor: SensorAttributes): Polygon | null {
    if (sensor.hideFov) return null;
    if (!sensor.range || !sensor.fov) return null;
    if (typeof sensor.azimuth !== 'number') return null;

    const elevation = sensor.elevation || 0;
    const ground = sensor.range * Math.cos(elevation * Math.PI / 180);
    if (ground < 1) return null;

    const half = sensor.fov / 2;

    return sector(
        [center[0], center[1]],
        ground / 1000,
        sensor.azimuth - half,
        sensor.azimuth + half
    ).geometry;
}

/**
 * ATAK publishes the cone colour as 0-1 fovRed/fovGreen/fovBlue/fovAlpha
 */
export function sensorStyle(sensor: SensorAttributes): { color: string, fill: number, stroke: number } {
    const channels = [sensor.fovRed, sensor.fovGreen, sensor.fovBlue];
    const custom = channels.every((channel) => typeof channel === 'number');

    const color = custom
        ? `rgb(${channels.map((channel) => Math.round(Math.min(Math.max(channel as number, 0), 1) * 255)).join(',')})`
        : SENSOR_COLOR;

    const fill = typeof sensor.fovAlpha === 'number'
        ? Math.min(Math.max(sensor.fovAlpha, 0), 1)
        : SENSOR_FILL_OPACITY;

    return { color, fill, stroke: SENSOR_STROKE_OPACITY };
}

export function derivedFeatures(
    feature: Feature,
    vectorId: (id: string) => number
): DerivedFeature[] {
    const features: DerivedFeature[] = [];

    const sensor = feature.properties.sensor;
    if (sensor && feature.geometry.type === 'Point') {
        const geometry = sensorFootprint(feature.geometry.coordinates, sensor);

        if (geometry) {
            const style = sensorStyle(sensor);
            const dim = typeof feature.properties['marker-opacity'] === 'number'
                ? feature.properties['marker-opacity']
                : 1;

            features.push({
                id: vectorId(`${feature.id}.${DERIVED_SENSOR}`),
                type: 'Feature',
                properties: {
                    id: feature.id,
                    path: feature.path || '/',
                    derived: DERIVED_SENSOR,
                    'sensor-color': style.color,
                    'sensor-fill-opacity': style.fill * dim,
                    'sensor-stroke-opacity': style.stroke * dim
                },
                geometry
            });
        }
    }

    return features;
}

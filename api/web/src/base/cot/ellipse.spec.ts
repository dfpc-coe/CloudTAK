import { describe, expect, it } from 'vitest';
import type { Feature } from '../../types.ts';
import {
    applyEllipseMutation,
    buildEllipseGeometry,
    createCircleEllipseShape,
    isEllipseType,
    readEllipseDefinition,
    setCircleRadius,
} from './ellipse.ts';
import type { COTUpdate } from './types.ts';

function ellipseFeature(properties?: Partial<Feature['properties']>): Feature {
    const mergedProperties = {
        id: 'ellipse-test',
        type: 'u-d-c-c',
        center: [-104.990251, 39.739236],
        shape: createCircleEllipseShape(1000),
        ...properties
    } as Feature['properties'];

    return {
        id: 'ellipse-test',
        type: 'Feature',
        path: '/',
        properties: mergedProperties,
        geometry: buildEllipseGeometry(mergedProperties) || {
            type: 'Polygon',
            coordinates: []
        }
    };
}

function applyMutation(feature: Feature, update: COTUpdate): COTUpdate {
    return applyEllipseMutation({ current: feature, update }) || update;
}

describe('ellipse mutations', () => {
    it('recognizes node-cot ellipse type families', () => {
        expect(isEllipseType('u-d-c-c')).toBe(true);
        expect(isEllipseType('u-r-b-c-c')).toBe(true);
        expect(isEllipseType('u-d-c-e')).toBe(true);
        expect(isEllipseType('u-d-f')).toBe(false);
    });

    it('creates circle ellipse shape metadata in meters', () => {
        expect(createCircleEllipseShape(1500)).toEqual({
            ellipse: {
                major: 1500,
                minor: 1500,
                angle: 360
            }
        });
    });

    it('reads ellipse definitions with center and shape metadata', () => {
        const definition = readEllipseDefinition(ellipseFeature({
            shape: {
                ellipse: {
                    major: 2000,
                    minor: 1000,
                    angle: 45,
                    swapAxis: true
                }
            }
        }).properties);

        expect(definition).toEqual({
            center: [-104.990251, 39.739236],
            shape: {
                major: 2000,
                minor: 1000,
                angle: 45,
                swapAxis: true
            }
        });
    });

    it('sets a circle radius while preserving existing ellipse options', () => {
        const feature = ellipseFeature({
            shape: {
                ellipse: {
                    major: 1000,
                    minor: 750,
                    angle: 30,
                    swapAxis: true
                }
            }
        });

        const properties = setCircleRadius(feature.properties, 2500);

        expect(properties).not.toBe(feature.properties);
        expect(properties.shape).toEqual({
            ellipse: {
                major: 2500,
                minor: 2500,
                angle: 30,
                swapAxis: true
            }
        });
    });

    it('rebuilds geometry when ellipse center changes', () => {
        const feature = ellipseFeature();
        const update = applyMutation(feature, {
            properties: {
                ...feature.properties,
                center: [-105.1, 39.9]
            }
        });

        expect(update.geometry).toBeDefined();
        expect(update.geometry).not.toEqual(feature.geometry);
    });

    it('rebuilds geometry around the updated center coordinates', () => {
        const feature = ellipseFeature();
        const update = applyMutation(feature, {
            properties: {
                ...feature.properties,
                center: [-110.0, 39.135606]
            }
        });

        expect(update.geometry?.type).toBe('Polygon');
        expect(update.geometry).not.toEqual(feature.geometry);

        const coordinates = update.geometry?.type === 'Polygon' ? update.geometry.coordinates[0] : [];
        const centerLng = coordinates.reduce((sum, coord) => sum + coord[0], 0) / coordinates.length;
        const centerLat = coordinates.reduce((sum, coord) => sum + coord[1], 0) / coordinates.length;

        expect(centerLng).toBeCloseTo(-110.0, 3);
        expect(centerLat).toBeCloseTo(39.135606, 3);
    });

    it('rebuilds geometry when ellipse shape changes', () => {
        const feature = ellipseFeature();
        const update = applyMutation(feature, {
            properties: setCircleRadius(feature.properties, 2000)
        });

        expect(update.geometry).toBeDefined();
        expect(update.geometry).not.toEqual(feature.geometry);
    });

    it('does not rebuild geometry for unrelated property changes', () => {
        const feature = ellipseFeature();
        const update = applyMutation(feature, {
            properties: {
                ...feature.properties,
                callsign: 'Updated Circle'
            }
        });

        expect(update.geometry).toBeUndefined();
    });
});

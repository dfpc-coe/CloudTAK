import Ellipse from '@turf/ellipse';
import type { Feature } from '../../types.ts';
import type { COTMutationContext, COTUpdate } from './types.ts';
import type { Geometry as GeoJSONGeometry } from 'geojson';

export const ELLIPSE_TYPE_PREFIXES = ['u-d-c-c', 'u-r-b-c-c', 'u-d-c-e'];

export type EllipseShape = {
    major: number;
    minor: number;
    angle: number;
    swapAxis?: boolean;
}

export type EllipseDefinition = {
    center: [number, number];
    shape: EllipseShape;
}

export function isEllipseType(type: unknown): boolean {
    return typeof type === 'string' && ELLIPSE_TYPE_PREFIXES.some((prefix) => type.startsWith(prefix));
}

export function readEllipseDefinition(properties: Feature['properties']): EllipseDefinition | undefined {
    const center = Array.isArray(properties.center) ? properties.center : undefined;
    const shape = properties.shape && typeof properties.shape === 'object'
        ? properties.shape as Record<string, unknown>
        : undefined;
    const ellipse = shape?.ellipse && typeof shape.ellipse === 'object'
        ? shape.ellipse as Record<string, unknown>
        : undefined;

    if (!center || center.length < 2 || !ellipse) return;

    const lng = Number(center[0]);
    const lat = Number(center[1]);
    const major = Number(ellipse.major);
    const minor = Number(ellipse.minor);
    const angle = Number.isFinite(Number(ellipse.angle)) ? Number(ellipse.angle) : 360;

    if (!Number.isFinite(lng) || !Number.isFinite(lat) || !Number.isFinite(major) || !Number.isFinite(minor)) {
        return;
    }

    return {
        center: [lng, lat],
        shape: {
            major,
            minor,
            angle,
            ...(ellipse.swapAxis !== undefined ? { swapAxis: Boolean(ellipse.swapAxis) } : {})
        }
    };
}

export function createCircleEllipseShape(radiusMeters: number, angle = 360): { ellipse: EllipseShape } {
    if (!Number.isFinite(radiusMeters) || radiusMeters < 0) {
        throw new Error('Radius must be a non-negative number');
    }

    return {
        ellipse: {
            major: radiusMeters,
            minor: radiusMeters,
            angle
        }
    };
}

export function buildEllipseGeometry(properties: Feature['properties']): GeoJSONGeometry | undefined {
    const definition = readEllipseDefinition(properties);
    if (!definition) return;

    return Ellipse(
        definition.center,
        definition.shape.major * 0.001,
        definition.shape.minor * 0.001,
        {
            angle: definition.shape.angle
        }
    ).geometry;
}

export function hasEllipseMutation(
    currentProperties: Feature['properties'],
    nextProperties: Feature['properties']
): boolean {
    const next = readEllipseDefinition(nextProperties);
    if (!next) return false;

    const current = readEllipseDefinition(currentProperties);
    if (!current) return true;

    return current.center[0] !== next.center[0]
        || current.center[1] !== next.center[1]
        || current.shape.major !== next.shape.major
        || current.shape.minor !== next.shape.minor
        || current.shape.angle !== next.shape.angle
        || current.shape.swapAxis !== next.shape.swapAxis;
}

export function setCircleRadius(
    properties: Feature['properties'],
    radiusMeters: number
): Feature['properties'] {
    if (!readEllipseDefinition(properties)) {
        throw new Error('Radius can only be set on ellipse features');
    }

    if (!Number.isFinite(radiusMeters) || radiusMeters < 0) {
        throw new Error('Radius must be a non-negative number');
    }

    const nextProperties = JSON.parse(JSON.stringify(properties)) as Feature['properties'];
    const shape = nextProperties.shape && typeof nextProperties.shape === 'object'
        ? nextProperties.shape as Record<string, unknown>
        : {};
    const ellipse = shape.ellipse && typeof shape.ellipse === 'object'
        ? shape.ellipse as Record<string, unknown>
        : {};

    shape.ellipse = {
        ...ellipse,
        ...createCircleEllipseShape(radiusMeters, Number.isFinite(Number(ellipse.angle)) ? Number(ellipse.angle) : 360).ellipse
    };

    nextProperties.shape = shape;

    return nextProperties;
}

export function applyEllipseMutation(context: COTMutationContext): COTUpdate | undefined {
    if (!context.update.properties || !hasEllipseMutation(context.current.properties, context.update.properties)) {
        return;
    }

    return {
        ...context.update,
        geometry: buildEllipseGeometry(context.update.properties)
    };
}

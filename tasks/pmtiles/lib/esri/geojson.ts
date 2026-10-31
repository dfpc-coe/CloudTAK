import { Type, Static } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';
import Err from '@openaddresses/batch-error';
import type { Feature, FeatureCollection, Geometry } from 'geojson';

type Position = [number, number];
type Ring = Array<Position>;

export const EsriTransform = Type.Object({
    originPosition: Type.Optional(Type.String()),
    scale: Type.Array(Type.Number()),
    translate: Type.Array(Type.Number()),
});

export const EsriFeature = Type.Object({
    attributes: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
    geometry: Type.Optional(Type.Union([Type.Null(), Type.Record(Type.String(), Type.Unknown())])),
});

export const EsriFeatureSet = Type.Object({
    objectIdFieldName: Type.Optional(Type.String()),
    geometryType: Type.Optional(Type.String()),
    transform: Type.Optional(EsriTransform),
    exceededTransferLimit: Type.Optional(Type.Boolean()),
    features: Type.Array(EsriFeature),
});

export const EsriErrorResponse = Type.Object({
    error: Type.Object({
        code: Type.Optional(Type.Number()),
        message: Type.Optional(Type.String()),
        details: Type.Optional(Type.Array(Type.String())),
    }),
});

/**
 * Validate an ArcGIS REST `f=json` query response, surfacing upstream error
 * payloads (which are returned with HTTP 200) as 400s.
 */
export function parseFeatureSet(body: unknown): Static<typeof EsriFeatureSet> {
    if (Value.Check(EsriErrorResponse, body)) {
        const details = body.error.details && body.error.details.length ? `: ${body.error.details.join(', ')}` : '';
        throw new Err(400, null, `Upstream Error: ${body.error.message || 'Unknown Error'}${details}`);
    }

    if (!Value.Check(EsriFeatureSet, body)) {
        throw new Err(400, null, 'Upstream Error: Invalid FeatureSet response');
    }

    return body;
}

/**
 * Convert an ArcGIS REST FeatureSet into GeoJSON.
 *
 * Rings are classified using the Esri convention (clockwise exterior,
 * counter-clockwise hole) and holes are nested inside the smallest containing
 * exterior ring. Quantized responses (those carrying a `transform`) are
 * delta-decoded and scaled back to real-world coordinates.
 */
export function esriToGeoJSON(fs: Static<typeof EsriFeatureSet>): FeatureCollection {
    const features: Array<Feature> = [];

    for (const esri of fs.features) {
        const geometry = esriGeometry(esri.geometry, fs.transform);
        if (!geometry) continue;

        const properties = esri.attributes || {};
        const id = featureId(properties, fs.objectIdFieldName);

        features.push({
            type: 'Feature',
            ...(id !== undefined ? { id } : {}),
            properties,
            geometry,
        });
    }

    return { type: 'FeatureCollection', features };
}

function featureId(
    properties: Record<string, unknown>,
    oidField?: string,
): number | string | undefined {
    for (const key of [oidField, 'OBJECTID', 'objectid', 'FID', 'fid'].filter((k): k is string => !!k)) {
        const value = properties[key];
        if (typeof value === 'number' || typeof value === 'string') return value;
    }

    return undefined;
}

function esriGeometry(
    geom: Static<typeof EsriFeature>['geometry'],
    transform?: Static<typeof EsriTransform>,
): Geometry | null {
    if (!geom) return null;

    if (Array.isArray(geom.rings)) {
        return polygon((geom.rings as Array<Array<Array<number>>>).map(ring => positions(ring, transform)));
    } else if (Array.isArray(geom.paths)) {
        const paths = (geom.paths as Array<Array<Array<number>>>)
            .map(path => positions(path, transform))
            .filter(path => path.length >= 2);

        if (!paths.length) return null;
        if (paths.length === 1) return { type: 'LineString', coordinates: paths[0] };
        return { type: 'MultiLineString', coordinates: paths };
    } else if (Array.isArray(geom.points)) {
        const points = positions(geom.points as Array<Array<number>>, transform);
        if (!points.length) return null;
        return { type: 'MultiPoint', coordinates: points };
    } else if (typeof geom.x === 'number' && typeof geom.y === 'number') {
        return { type: 'Point', coordinates: positions([[geom.x, geom.y]], transform)[0] };
    }

    return null;
}

function positions(
    coords: Array<Array<number>>,
    transform?: Static<typeof EsriTransform>,
): Ring {
    if (!transform) {
        return coords.map(c => [c[0], c[1]]);
    }

    const [sx, sy] = transform.scale;
    const [tx, ty] = transform.translate;
    const ySign = transform.originPosition === 'lowerLeft' ? 1 : -1;

    let qx = 0;
    let qy = 0;

    return coords.map((c, i) => {
        if (i === 0) {
            qx = c[0];
            qy = c[1];
        } else {
            qx += c[0];
            qy += c[1];
        }

        return [tx + qx * sx, ty + ySign * qy * sy];
    });
}

function polygon(rings: Array<Ring>): Geometry | null {
    const outers: Array<{ area: number; rings: Array<Ring> }> = [];
    const holes: Array<Ring> = [];

    for (const input of rings) {
        const ring = closeRing(input);
        if (ring.length < 4) continue;

        const area = signedArea(ring);
        if (area === 0) continue;

        if (area > 0) {
            outers.push({ area, rings: [ring.reverse()] });
        } else {
            holes.push(ring);
        }
    }

    for (const hole of holes) {
        let match: typeof outers[number] | null = null;

        for (const outer of outers) {
            if (match && outer.area >= match.area) continue;

            if (ringContainsAny(outer.rings[0], hole)) {
                match = outer;
            }
        }

        if (match) {
            match.rings.push(hole.reverse());
        } else {
            outers.push({ area: -signedArea(hole), rings: [hole] });
        }
    }

    if (!outers.length) return null;
    if (outers.length === 1) return { type: 'Polygon', coordinates: outers[0].rings };
    return { type: 'MultiPolygon', coordinates: outers.map(o => o.rings) };
}

function closeRing(ring: Ring): Ring {
    const first = ring[0];
    const last = ring[ring.length - 1];

    if (first && last && (first[0] !== last[0] || first[1] !== last[1])) {
        return [...ring, [first[0], first[1]]];
    }

    return ring.slice();
}

/**
 * Positive for clockwise rings (Esri exterior), negative for counter-clockwise (Esri hole)
 */
function signedArea(ring: Ring): number {
    let area = 0;

    for (let i = 0; i < ring.length - 1; i++) {
        area += (ring[i + 1][0] - ring[i][0]) * (ring[i + 1][1] + ring[i][1]);
    }

    return area;
}

function ringContainsAny(ring: Ring, candidates: Ring): boolean {
    for (let i = 0; i < Math.min(3, candidates.length - 1); i++) {
        if (ringContainsPoint(ring, candidates[i])) return true;
    }

    return false;
}

function ringContainsPoint(ring: Ring, point: Position): boolean {
    let inside = false;

    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i];
        const [xj, yj] = ring[j];

        if (((yi > point[1]) !== (yj > point[1]))
            && (point[0] < (xj - xi) * (point[1] - yi) / (yj - yi) + xi)) {
            inside = !inside;
        }
    }

    return inside;
}

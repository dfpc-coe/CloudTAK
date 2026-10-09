import type { LineString, Polygon, Position } from 'geojson';

/**
 * MIL-STD-2525D Axis of Advance control measures (symbol set 25).
 * Entity codes come from the 2525D Control Measures table.
 */
export const AXIS_OF_ADVANCE_VARIANTS = [
    { label: 'Main Attack', entity: '151403' },
    { label: 'Supporting Attack', entity: '151404' },
    { label: 'Friendly Airborne/Aviation', entity: '151401' },
    { label: 'Attack Helicopter', entity: '151402' },
] as const;

export type AxisOfAdvanceVariant = typeof AXIS_OF_ADVANCE_VARIANTS[number]['label'];

export const AXIS_OF_ADVANCE_AFFILIATIONS = {
    Friendly: '3',
    Hostile: '6',
    Neutral: '4',
    Unknown: '1',
} as const;

export type AxisOfAdvanceAffiliation = keyof typeof AXIS_OF_ADVANCE_AFFILIATIONS;

/**
 * Build a 20 digit 2525D SIDC for an Axis of Advance:
 * version 10, context 0 (reality), standard identity, symbol set 25,
 * status 0, HQ 0, amplifier 00, entity, modifiers 00 00.
 */
export function axisOfAdvanceSIDC(variant: string, affiliation: string = 'Friendly'): string {
    const def = AXIS_OF_ADVANCE_VARIANTS.find((v) => v.label === variant);
    if (!def) throw new Error(`Unknown Axis of Advance variant: ${variant}`);

    const identity = AXIS_OF_ADVANCE_AFFILIATIONS[affiliation as AxisOfAdvanceAffiliation];
    if (!identity) throw new Error(`Unknown affiliation: ${affiliation}`);

    return `10${'0'}${identity}${'25'}${'0'}${'0'}${'00'}${def.entity}${'0000'}`;
}

const METERS_PER_DEGREE = 111320;

type Planar = { x: number; y: number };

/**
 * Equirectangular projection centred on `origin`, accurate enough for the
 * few kilometres a drawn axis spans.
 */
function projector(origin: Position) {
    const cosLat = Math.cos(origin[1] * Math.PI / 180);

    return {
        to(p: Position): Planar {
            return {
                x: (p[0] - origin[0]) * cosLat * METERS_PER_DEGREE,
                y: (p[1] - origin[1]) * METERS_PER_DEGREE
            };
        },
        from(p: Planar): Position {
            return [
                origin[0] + p.x / (cosLat * METERS_PER_DEGREE),
                origin[1] + p.y / METERS_PER_DEGREE
            ];
        }
    };
}

function sub(a: Planar, b: Planar): Planar {
    return { x: a.x - b.x, y: a.y - b.y };
}

function add(a: Planar, b: Planar): Planar {
    return { x: a.x + b.x, y: a.y + b.y };
}

function scale(a: Planar, s: number): Planar {
    return { x: a.x * s, y: a.y * s };
}

function dot(a: Planar, b: Planar): number {
    return a.x * b.x + a.y * b.y;
}

function mag(a: Planar): number {
    return Math.sqrt(a.x * a.x + a.y * a.y);
}

function unit(a: Planar): Planar {
    const m = mag(a);
    return m === 0 ? { x: 0, y: 0 } : scale(a, 1 / m);
}

function leftNormal(d: Planar): Planar {
    return { x: -d.y, y: d.x };
}

function dedupe(points: Planar[]): Planar[] {
    const out: Planar[] = [];
    for (const p of points) {
        const last = out[out.length - 1];
        if (!last || mag(sub(p, last)) > 1e-6) out.push(p);
    }
    return out;
}

/**
 * Offset a polyline sideways by `dist` metres (positive = left of travel)
 * using mitred joins, capped so sharp angles do not produce spikes.
 */
function offsetPolyline(points: Planar[], dist: number): Planar[] {
    if (points.length < 2) return points.slice();

    const normals: Planar[] = [];
    for (let i = 0; i < points.length - 1; i++) {
        normals.push(leftNormal(unit(sub(points[i + 1], points[i]))));
    }

    const maxMiter = 3;

    return points.map((p, i) => {
        if (i === 0) return add(p, scale(normals[0], dist));
        if (i === points.length - 1) return add(p, scale(normals[normals.length - 1], dist));

        const avg = unit(add(normals[i - 1], normals[i]));
        const cos = dot(avg, normals[i]);
        const miter = cos < 1 / maxMiter ? maxMiter : 1 / cos;

        return add(p, scale(avg, dist * miter));
    });
}

/**
 * Total length in metres of a tail to head path.
 */
export function pathLengthMeters(path: Position[]): number {
    if (path.length < 2) return 0;
    const proj = projector(path[path.length - 1]);
    const pts = path.map((p) => proj.to(p));
    let total = 0;
    for (let i = 1; i < pts.length; i++) total += mag(sub(pts[i], pts[i - 1]));
    return total;
}

/**
 * Arrow width implied by a control point, measured as twice its perpendicular
 * distance from the line through the head segment (last two path points).
 * This mirrors how ATAK derives the width from the __milsym link point.
 */
export function widthFromControlPoint(path: Position[], controlPoint: Position): number {
    if (path.length < 2) return 0;

    const head = path[path.length - 1];
    const prev = path[path.length - 2];
    const proj = projector(head);

    const h = proj.to(head);
    const d = unit(sub(h, proj.to(prev)));
    const cp = sub(proj.to(controlPoint), h);

    return Math.abs(dot(cp, leftNormal(d))) * 2;
}

/**
 * Place a control point on the left edge of the arrow head base for a given
 * width, so a width chosen numerically can still round trip through ATAK.
 */
export function controlPointForWidth(path: Position[], widthMeters: number): Position {
    const head = path[path.length - 1];
    const prev = path[path.length - 2];
    const proj = projector(head);

    const h = proj.to(head);
    const toPrev = sub(proj.to(prev), h);
    const d = unit(scale(toPrev, -1));
    const headLen = Math.min(widthMeters, mag(toPrev));
    const base = sub(h, scale(d, headLen));

    return proj.from(add(base, scale(leftNormal(d), widthMeters / 2)));
}

/**
 * Default arrow width when the user has not chosen one: a fraction of the
 * path length with a floor so short axes remain visible.
 */
export function defaultWidthMeters(path: Position[]): number {
    return Math.max(10, pathLengthMeters(path) * 0.15);
}

/**
 * Build the outline of an Axis of Advance as a Polygon.
 *
 * `path` runs tail to head (the direction of advance). The shaft is a corridor
 * half the arrow width wide; the head is an isosceles triangle whose base is
 * `widthMeters` across and whose length is capped by the final segment.
 */
export function axisOfAdvancePolygon(path: Position[], widthMeters: number): Polygon | undefined {
    if (path.length < 2 || !(widthMeters > 0)) return;

    const proj = projector(path[path.length - 1]);
    const pts = dedupe(path.map((p) => proj.to(p)));
    if (pts.length < 2) return;

    const head = pts[pts.length - 1];
    const prev = pts[pts.length - 2];
    const d = unit(sub(head, prev));
    const n = leftNormal(d);

    const headLen = Math.min(widthMeters, mag(sub(head, prev)));
    const base = sub(head, scale(d, headLen));

    const shaft = pts.slice(0, -1).concat([base]);
    const shaftHalf = widthMeters / 4;
    const left = offsetPolyline(shaft, shaftHalf);
    const right = offsetPolyline(shaft, -shaftHalf);

    const ring: Planar[] = [
        ...left,
        add(base, scale(n, widthMeters / 2)),
        head,
        sub(base, scale(n, widthMeters / 2)),
        ...right.reverse(),
    ];
    ring.push(ring[0]);

    return {
        type: 'Polygon',
        coordinates: [ring.map((p) => proj.from(p))]
    };
}

/**
 * ATAK and the mil-sym renderer expect the arrow head at the first coordinate,
 * so the CoT centerline is the drawn path reversed.
 */
export function axisOfAdvanceCenterline(path: Position[]): LineString {
    return {
        type: 'LineString',
        coordinates: path.slice().reverse()
    };
}

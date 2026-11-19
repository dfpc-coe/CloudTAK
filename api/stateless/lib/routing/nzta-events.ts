import { fetch } from '@tak-ps/node-safeurl';

/**
 * NZTA (Waka Kotahi) road events for the CloudTAK route planner.
 *
 * Full closures are handed to ArcGIS as restriction barriers so the route goes around them. Delays are only
 * reported: the feed gives delay length as free text ("expect up to 10 minute delays"), which is not reliable
 * enough to change a route, and ArcGIS's own traffic may already account for some of it. Reported delay minutes
 * are therefore never added to the ArcGIS route time.
 *
 * The matching logic follows the TAK-NZ/tak-infra `lambda/arcgis-geocode` reference implementation.
 */

export const NZTA_DELAYS_URL = 'https://www.journeys.nzta.govt.nz/assets/map-data-cache/delays.json';

/** An event counts as "on the route" when any of its vertices is this close to the route */
export const EVENT_NEAR_ROUTE_KM = 1;
/** A full closure blocks the route when it lies this close to it */
export const CLOSURE_ON_ROUTE_KM = 0.3;
/** Route and event geometry is densified to this spacing before matching */
const DENSIFY_KM = 0.25;
/** Events listed individually in the route remarks, the rest are summarised */
export const MAX_EVENTS_LISTED = 8;
/** Upper bound on closure barrier features sent to ArcGIS in one request (service limit: 250 points / 500 streets for lines) */
export const MAX_BARRIER_FEATURES = 100;

const FEED_TIMEOUT_MS = 10_000;
const FEED_CACHE_MS = 60_000;

export interface NZTAGeometry {
    type: string;
    coordinates: unknown;
}

export interface NZTAEvent {
    geometry?: NZTAGeometry | null;
    properties?: Record<string, unknown> | null;
}

export interface TripWindow {
    start: Date;
    end: Date;
}

export interface ClosureBarriers {
    /** [lon, lat] */
    points: Array<[number, number]>;
    /** Each entry is one path of [lon, lat] vertices */
    lines: Array<Array<[number, number]>>;
}

export interface ClosurePlan {
    /** Closures that lie on the current route */
    blocking: NZTAEvent[];
    barriers: ClosureBarriers;
}

export type DetourState = 'found' | 'none' | 'failed';

export interface RouteSummary {
    km: number;
    minutes: number;
}

/* ------------------------------------------------------------------ feed */

let cache: { at: number; events: NZTAEvent[] } | undefined;
let inflight: Promise<NZTAEvent[]> | undefined;

/**
 * Fetch the NZTA delays and closures GeoJSON. Cached for a minute, since a route is often regenerated
 * several times in a row. Rejects if the feed cannot be read - callers should treat that as "unknown".
 */
export async function fetchNZTAEvents(): Promise<NZTAEvent[]> {
    if (cache && Date.now() - cache.at < FEED_CACHE_MS) return cache.events;
    if (inflight) return inflight;

    inflight = (async () => {
        const res = await fetch(NZTA_DELAYS_URL, { timeout: FEED_TIMEOUT_MS });
        if (!res.ok) throw new Error(`NZTA feed returned ${res.status}`);

        const body = await res.json() as { features?: unknown };
        if (!body || !Array.isArray(body.features)) throw new Error('NZTA feed has no features');

        const events = body.features.filter((f): f is NZTAEvent => !!f && typeof f === 'object');
        cache = { at: Date.now(), events };
        return events;
    })().finally(() => {
        inflight = undefined;
    });

    return inflight;
}

/** Drop the cached feed. Used by tests. */
export function resetNZTACache(): void {
    cache = undefined;
    inflight = undefined;
}

/**
 * True if both stops ([lon, lat]) are in New Zealand, including the Chatham Islands and the Kermadecs.
 * The NZTA feed is meaningless anywhere else.
 */
export function inNewZealand(stops: Array<[number, number]>): boolean {
    return stops.length > 0 && stops.every(([lon, lat]) => {
        return lat >= -48.5 && lat <= -29 && (lon >= 165 || lon <= -175);
    });
}

/* ------------------------------------------------------------------ time */

const NZ_TZ = 'Pacific/Auckland';

const nzFormat = new Intl.DateTimeFormat('en-NZ', {
    timeZone: NZ_TZ,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
});

function nzParts(at: Date): Record<string, number> {
    const parts: Record<string, number> = {};
    for (const part of nzFormat.formatToParts(at)) {
        if (part.type !== 'literal') parts[part.type] = Number(part.value);
    }
    return parts;
}

/** Offset of Pacific/Auckland from UTC at the given instant, in ms */
function nzOffsetMs(at: Date): number {
    const p = nzParts(at);
    const asUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    return asUTC - Math.floor(at.getTime() / 1000) * 1000;
}

/** NZTA timestamps are New Zealand local time, `YYYY-MM-DD HH:MM:SS`, with no zone */
export function parseNZTime(value: unknown): Date | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec((typeof value === 'string' || typeof value === 'number' ? String(value) : ''));
    if (!m) return null;

    const naive = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6]));

    // The offset can differ either side of a daylight saving change, so refine the first guess once
    const guess = naive - nzOffsetMs(new Date(naive));
    return new Date(naive - nzOffsetMs(new Date(guess)));
}

/** Minutes after local midnight in New Zealand */
function nzMinutesOfDay(at: Date): number {
    const p = nzParts(at);
    return p.hour * 60 + p.minute;
}

function prop(event: NZTAEvent, key: string): string {
    const value = event.properties?.[key];
    return typeof value === 'string' ? value : '';
}

/** Is the event in force at some point in the trip window? A missing end date means open-ended. */
export function isRelevant(event: NZTAEvent, window: TripWindow): boolean {
    const start = parseNZTime(prop(event, 'StartDate'));
    const end = parseNZTime(prop(event, 'EndDate'));

    return (start === null || start <= window.end) && (end === null || end >= window.start);
}

/* ------------------------------------------------------------------ comment text */

interface HourRange {
    from: number;
    to: number;
}

const CLOCK = String.raw`(\d{1,2})(?::(\d{2}))?\s*(am|pm)`;
const HOURS_RX = new RegExp(String.raw`between\s+${CLOCK}\s*(?:and|to|-|–)\s*${CLOCK}`, 'gi');

function toMinutes(hour: string, minute: string | undefined, meridiem: string): number {
    return (Number(hour) % 12 + (meridiem.toLowerCase() === 'pm' ? 12 : 0)) * 60 + Number(minute ?? 0);
}

/** Daily hours a comment restricts the event to, e.g. "between 7am and 7pm". Empty if none are stated. */
export function parseHours(comment: string): HourRange[] {
    const ranges: HourRange[] = [];

    for (const m of comment.matchAll(HOURS_RX)) {
        ranges.push({ from: toMinutes(m[1], m[2], m[3]), to: toMinutes(m[4], m[5], m[6]) });
    }

    return ranges;
}

/**
 * Does the trip overlap the hours the comment restricts the event to? Always true when no hours are stated or
 * the trip is longer than a day.
 */
export function withinStatedHours(comment: string, window: TripWindow): boolean {
    const ranges = parseHours(comment);
    if (!ranges.length) return true;
    if (window.end.getTime() - window.start.getTime() >= 24 * 60 * 60 * 1000) return true;

    for (let t = window.start.getTime(); t <= window.end.getTime() + 15 * 60 * 1000; t += 15 * 60 * 1000) {
        const minute = nzMinutesOfDay(new Date(t));

        for (const range of ranges) {
            const inside = range.from <= range.to
                ? minute >= range.from && minute <= range.to
                : minute >= range.from || minute <= range.to; // runs overnight, e.g. 7pm to 6am
            if (inside) return true;
        }
    }

    return false;
}

const DELAY_PATTERNS = [
    /(\d+)\s*[- ]?min(?:ute)?s?\s+delays?/i, // "up to 10 minute delays", "10-minute delays"
    /delays?\s+(?:of\s+)?(?:up\s+to\s+|about\s+|around\s+)?(\d+)\s*[- ]?min/i, // "delays of up to 10 minutes"
    /allowing\s+(?:an\s+extra\s+)?(?:up\s+to\s+)?(\d+)\s*[- ]?min/i, // "allowing up to 10 minutes for your travel"
];

/** The delay in minutes a comment warns of. This is an upper bound ("up to N"), or null if none is stated. */
export function parseDelayMinutes(comment: string): number | null {
    for (const pattern of DELAY_PATTERNS) {
        const m = pattern.exec(comment);
        if (m) return Number(m[1]);
    }

    return null;
}

/* ------------------------------------------------------------------ geometry */

type Position = [number, number];

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const rad = Math.PI / 180;
    const dLat = (lat2 - lat1) * rad;
    const dLon = (lon2 - lon1) * rad;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Insert vertices so that no segment is longer than `stepKm` */
function densify(lines: Array<Array<number[]>>, stepKm: number): Position[] {
    const out: Position[] = [];

    for (const line of lines) {
        for (let i = 0; i < line.length; i++) {
            const p = line[i];
            out.push([p[0], p[1]]);

            const q = line[i + 1];
            if (!q) continue;

            const n = Math.floor(haversineKm(p[1], p[0], q[1], q[0]) / stepKm);
            for (let k = 1; k <= n; k++) {
                const f = k / (n + 1);
                out.push([p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f]);
            }
        }
    }

    return out;
}

/** All vertices of a GeoJSON geometry, with line segments densified */
function vertices(geometry: NZTAGeometry | null | undefined): Position[] {
    if (!geometry || !Array.isArray(geometry.coordinates)) return [];
    const raw = geometry.coordinates as unknown[];

    switch (geometry.type) {
        case 'Point':
            return [[Number(raw[0]), Number(raw[1])]];
        case 'MultiPoint':
            return (raw as number[][]).map(p => [p[0], p[1]] as Position);
        case 'LineString':
            return densify([raw as number[][]], DENSIFY_KM);
        case 'MultiLineString':
        case 'Polygon':
            return densify(raw as number[][][], DENSIFY_KM);
        case 'MultiPolygon':
            return densify((raw as number[][][][]).flat(), DENSIFY_KM);
        default:
            return [];
    }
}

/** Grid index, so "is any route vertex within X km of this point" does not compare every pair */
class PointIndex {
    // about 1.5 to 2.2 km in New Zealand
    static readonly CELL = 0.02;

    cells = new Map<string, Position[]>();

    constructor(points: Position[]) {
        for (const p of points) {
            const key = PointIndex.key(p[0], p[1]);
            const cell = this.cells.get(key);
            if (cell) {
                cell.push(p);
            } else {
                this.cells.set(key, [p]);
            }
        }
    }

    static key(lon: number, lat: number): string {
        return `${Math.floor(lat / PointIndex.CELL)},${Math.floor(lon / PointIndex.CELL)}`;
    }

    within(lon: number, lat: number, maxKm: number): boolean {
        const ci = Math.floor(lat / PointIndex.CELL);
        const cj = Math.floor(lon / PointIndex.CELL);

        for (let di = -1; di <= 1; di++) {
            for (let dj = -1; dj <= 1; dj++) {
                for (const p of this.cells.get(`${ci + di},${cj + dj}`) ?? []) {
                    if (haversineKm(lat, lon, p[1], p[0]) <= maxKm) return true;
                }
            }
        }

        return false;
    }
}

function indexRoute(path: number[][]): PointIndex {
    return new PointIndex(densify([path], DENSIFY_KM));
}

function nearRoute(index: PointIndex, event: NZTAEvent, maxKm: number): boolean {
    return vertices(event.geometry).some(([lon, lat]) => index.within(lon, lat, maxKm));
}

function closureLines(geometry: NZTAGeometry | null | undefined): Array<Array<Position>> {
    if (!geometry || !Array.isArray(geometry.coordinates)) return [];

    if (geometry.type === 'LineString') {
        return [(geometry.coordinates as number[][]).map(p => [p[0], p[1]] as Position)];
    } else if (geometry.type === 'MultiLineString') {
        return (geometry.coordinates as number[][][])
            .filter(line => line.length >= 2)
            .map(line => line.map(p => [p[0], p[1]] as Position));
    }

    return [];
}

function closurePoints(geometry: NZTAGeometry | null | undefined): Position[] {
    if (!geometry || !Array.isArray(geometry.coordinates)) return [];

    if (geometry.type === 'Point') {
        return [[Number(geometry.coordinates[0]), Number(geometry.coordinates[1])]];
    } else if (geometry.type === 'MultiPoint') {
        return (geometry.coordinates as number[][]).map(p => [p[0], p[1]] as Position);
    }

    return [];
}

/* ------------------------------------------------------------------ closures */

export function isFullClosure(event: NZTAEvent): boolean {
    return prop(event, 'Impact') === 'Road Closed';
}

/**
 * Work out which full closures matter for the given route.
 *
 * Returns null if no active closure lies on it. Otherwise returns the closures on the route plus the barriers
 * to send to ArcGIS: every closure in force during the trip, nearest to the route first, up to
 * MAX_BARRIER_FEATURES. Sending all of them (not only those on the current route) means one detour solve finds a
 * route that avoids every known closure, instead of discovering them one re-solve at a time.
 */
export function planClosures(events: NZTAEvent[], routePath: number[][], window: TripWindow): ClosurePlan | null {
    const active = events.filter(e => e.geometry && isFullClosure(e) && isRelevant(e, window));
    if (!active.length) return null;

    const index = indexRoute(routePath);
    const blocking = active.filter(e => nearRoute(index, e, CLOSURE_ON_ROUTE_KM));
    if (!blocking.length) return null;

    const middle = routePath[Math.floor(routePath.length / 2)];
    const distance = (e: NZTAEvent): number => {
        const [lon, lat] = vertices(e.geometry)[0] ?? [middle[0], middle[1]];
        return haversineKm(middle[1], middle[0], lat, lon);
    };

    const ordered = [
        ...blocking,
        ...active.filter(e => !blocking.includes(e)).sort((a, b) => distance(a) - distance(b)),
    ];

    const barriers: ClosureBarriers = { points: [], lines: [] };
    for (const event of ordered) {
        if (barriers.points.length + barriers.lines.length >= MAX_BARRIER_FEATURES) break;
        barriers.points.push(...closurePoints(event.geometry));
        barriers.lines.push(...closureLines(event.geometry));
    }

    return { blocking, barriers };
}

/* ------------------------------------------------------------------ text */

const SEVERITY: Record<string, number> = {
    'Road Closed': 0,
    'Delays': 1,
    'Vehicle Restrictions': 2,
    'Caution': 3,
};

const OPERATIONAL = /stop\s*\/?\s*go|delay|clos(?:ed|ure)|detour|minute|one lane/i;

/** Shorten text to `max` characters, marking the cut so it does not end mid-word without warning */
function clip(text: string, max: number): string {
    return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

function formatMinutes(total: number): string {
    const m = Math.round(total);
    return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min` : `${m} min`;
}

/** One event as a single line of text */
export function describeEvent(event: NZTAEvent): string {
    const impact = prop(event, 'Impact') || 'Info';
    const what = [prop(event, 'EventType'), prop(event, 'EventDescription')].filter(Boolean).join(' - ');

    let when = '';
    if (prop(event, 'StartDateNice') || prop(event, 'EndDateNice')) {
        when = ` (${prop(event, 'StartDateNice') || '?'} to ${prop(event, 'EndDateNice') || 'further notice'})`;
    }

    // Always keep the comment for closures and delays. Elsewhere keep it only when it says something operational,
    // so the remarks stay short.
    const comment = prop(event, 'EventComments').trim().replace(/\s+/g, ' ');
    const note = comment && (impact === 'Road Closed' || impact === 'Delays' || OPERATIONAL.test(comment))
        ? ` ${clip(comment, 160)}`
        : '';

    const alternative = impact === 'Road Closed' && prop(event, 'AlternativeRoute')
        ? ` Alternative: ${clip(prop(event, 'AlternativeRoute'), 80)}`
        : '';

    return `- [${impact}] ${prop(event, 'LocationArea') || 'unknown location'}: ${what}${when}.${note}${alternative}`;
}

export interface Outcome {
    /** null if the feed could not be read */
    events: NZTAEvent[] | null;
    window: TripWindow;
    /** The route ArcGIS gave without any barriers */
    direct: RouteSummary;
    /** The route returned to the user, and the path it follows as [lon, lat] vertices */
    final: RouteSummary;
    finalPath: number[][] | null;
    /** Active full closures that lie on the direct route */
    blocking: NZTAEvent[];
    detour: DetourState;
}

/**
 * Plain-text summary of what NZTA reports for the route, written for the remarks of the route feature.
 * Returns an empty string if there is nothing to say.
 */
export function describeOutcome(outcome: Outcome): string {
    const out: string[] = [];

    if (outcome.events === null) {
        return 'NZTA road events could not be loaded, so current delays and closures are unknown.';
    }

    if (outcome.blocking.length) {
        out.push('ROAD CLOSED on the direct route:');
        out.push(...outcome.blocking.map(describeEvent));

        const direct = `${outcome.direct.km.toFixed(0)} km, ${formatMinutes(outcome.direct.minutes)}`;
        if (outcome.detour === 'found') {
            const km = outcome.final.km - outcome.direct.km;
            const minutes = outcome.final.minutes - outcome.direct.minutes;
            out.push(`Detour avoiding the closure: ${km >= 0 ? '+' : ''}${km.toFixed(0)} km, ${minutes >= 0 ? '+' : '-'}${formatMinutes(Math.abs(minutes))} (direct route ${direct}).`);
        } else if (outcome.detour === 'none') {
            out.push(`No alternative route exists while these roads are closed. Showing the direct route (${direct}), which is blocked.`);
        } else {
            out.push(`The detour could not be calculated. Showing the direct route (${direct}), which is blocked.`);
        }
    }

    const index = outcome.finalPath ? indexRoute(outcome.finalPath) : undefined;
    const along = index
        ? outcome.events.filter((e) => {
                return e.geometry
                    && !outcome.blocking.includes(e)
                    && isRelevant(e, outcome.window)
                    && nearRoute(index, e, EVENT_NEAR_ROUTE_KM);
            })
        : [];

    along.sort((a, b) => {
        return (SEVERITY[prop(a, 'Impact')] ?? 4) - (SEVERITY[prop(b, 'Impact')] ?? 4)
            || prop(a, 'LocationArea').localeCompare(prop(b, 'LocationArea'));
    });

    if (along.length) {
        out.push(`NZTA events on or near the route (${along.length}):`);
        out.push(...along.slice(0, MAX_EVENTS_LISTED).map(describeEvent));
        if (along.length > MAX_EVENTS_LISTED) {
            out.push(`- ... and ${along.length - MAX_EVENTS_LISTED} more minor events.`);
        }

        // Delays are an upper bound and are reported separately: they are not part of the ArcGIS route time
        let total = 0;
        let stated = 0;
        for (const e of along) {
            const minutes = parseDelayMinutes(prop(e, 'EventComments'));
            if (minutes === null || !withinStatedHours(prop(e, 'EventComments'), outcome.window)) continue;
            total += minutes;
            stated++;
        }

        if (total > 0) {
            out.push(`Possible delays from ${stated} of these events: up to ${formatMinutes(total)} in total if every one applies. This is not included in the route time.`);
        }
    } else if (!outcome.blocking.length) {
        out.push('No NZTA delays or closures reported on or near the route.');
    }

    return out.join('\n');
}

import fs from 'node:fs';
import Err from '@openaddresses/batch-error';
import { fetch } from '@tak-ps/node-safeurl';
import { FixedWindowLimiter } from './relay-limiter.js';
import { TileCache, SingleFlight } from './relay-cache.js';
import type { TileType } from './relay-cache.js';
import { upstreamAllowForTests, __resetWarned } from './relay-config.js';
import type { WeatherLayer } from './relay-request.js';
import type { LayerLatest } from './relay-snapshot.js';

export { upstreamAllowForTests };
export type { TileType };

const pkg = JSON.parse(String(fs.readFileSync(new URL('../../../package.json', import.meta.url))));

export const UPSTREAM_TIMEOUT_MS = 8000;
export const MAX_TILE_BYTES = 1024 * 1024;
export const MAX_JSON_BYTES = 4096;
/** How long the relay waits for the newest snapshot of a layer before it uses the computed one */
export const LATEST_BUDGET_MS = 2500;
export const UNAVAILABLE = 'Weather upstream unavailable';

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
/** RIFF header (12 bytes) plus one chunk header (8 bytes) */
const WEBP_MIN_BYTES = 20;
const WEBP_CHUNKS = ['VP8 ', 'VP8L', 'VP8X'];
const LOG_INTERVAL_MS = 60000;
/** Seconds to stop calling the weather proxy when it gives no (or an unusable) Retry-After */
export const PAUSE_DEFAULT_S = 30;
export const PAUSE_MIN_S = 5;
export const PAUSE_MAX_S = 120;

export interface UpstreamResponse {
    status: number;
    /** Image type detected from the body bytes; set only for an accepted 200 answer */
    contentType: TileType | null;
    body: Buffer | null;
    fallback: boolean;
    error: boolean;
    cacheControl: string | null;
    retryAfterS: number | null;
    /** `X-Weather-Snapshot` of the answer (the snapshot the proxy served), or null when absent or malformed */
    snapshot: number | null;
}

export interface FlightResult {
    body: Buffer;
    contentType: TileType;
    /** True when the tile is a transient fallback that must only be cached briefly by the client */
    short: boolean;
    /** True when the proxy confirmed the snapshot, so the tile never changes */
    immutable: boolean;
}

export interface RelayOptions {
    now?: () => number;
    upstreamTimeoutMs?: number;
    cacheMaxBytes?: number;
    latestBudgetMs?: number;
}

export interface RelayRuntime {
    now: () => number;
    upstreamTimeoutMs: number;
    /** Tile requests per user per minute */
    tile: FixedWindowLimiter;
    /** Upstream fetches led by one user per minute */
    miss: FixedWindowLimiter;
    /** Upstream fetches per task per minute */
    task: FixedWindowLimiter;
    /** Status calls per user per minute */
    status: FixedWindowLimiter;
    cache: TileCache;
    flights: SingleFlight<FlightResult>;
    logged: Map<string, number>;
    /** Newest snapshot per layer as reported by the proxy, cached for 30 s */
    latest: Map<WeatherLayer, { value: LayerLatest; expires: number }>;
    latestFlights: SingleFlight<LayerLatest>;
    /** Longest wait for a newest-snapshot lookup before the computed value is used */
    latestBudgetMs: number;
    /** Epoch ms until which no cache miss may call the weather proxy (0 = not paused). Per process. */
    pausedUntil: number;
}

function create(opts: RelayOptions): RelayRuntime {
    const runtime: RelayRuntime = {
        now: opts.now ?? (() => Date.now()),
        upstreamTimeoutMs: opts.upstreamTimeoutMs ?? UPSTREAM_TIMEOUT_MS,
        tile: undefined as unknown as FixedWindowLimiter,
        miss: undefined as unknown as FixedWindowLimiter,
        task: undefined as unknown as FixedWindowLimiter,
        status: undefined as unknown as FixedWindowLimiter,
        cache: undefined as unknown as TileCache,
        flights: new SingleFlight<FlightResult>(),
        logged: new Map(),
        latest: new Map(),
        latestFlights: new SingleFlight<LayerLatest>(),
        latestBudgetMs: opts.latestBudgetMs ?? LATEST_BUDGET_MS,
        pausedUntil: 0,
    };

    const now = () => runtime.now();
    runtime.tile = new FixedWindowLimiter({ windowMs: 60000, now });
    runtime.miss = new FixedWindowLimiter({ windowMs: 60000, now });
    runtime.task = new FixedWindowLimiter({ windowMs: 60000, now });
    runtime.status = new FixedWindowLimiter({ windowMs: 60000, now });
    runtime.cache = new TileCache({ now, maxBytes: opts.cacheMaxBytes });

    return runtime;
}

export const relay: RelayRuntime = create({});

/**
 * Test hook: replace all limiters, the caches, the single-flight maps and the
 * warning memory. Production code never calls this.
 */
export function __resetForTests(opts: RelayOptions = {}): void {
    for (const limiter of [relay.tile, relay.miss, relay.task, relay.status]) limiter.stop();

    Object.assign(relay, create(opts));
    __resetWarned();
}

/**
 * Stop all upstream fetches of this process for a while.
 *
 * `retryAfterS` is the upstream Retry-After (or null). The pause is clamped to
 * 5..120 s and defaults to 30 s. A shorter pause never replaces a longer one.
 * Returns the pause in seconds.
 */
export function pauseUpstream(retryAfterS: number | null): number {
    const seconds = retryAfterS === null || !Number.isFinite(retryAfterS)
        ? PAUSE_DEFAULT_S
        : Math.min(PAUSE_MAX_S, Math.max(PAUSE_MIN_S, Math.ceil(retryAfterS)));
    relay.pausedUntil = Math.max(relay.pausedUntil, relay.now() + (seconds * 1000));
    return seconds;
}

/**
 * Seconds left of the upstream pause, rounded up; 0 when upstream calls are allowed
 */
export function upstreamPausedFor(): number {
    const left = relay.pausedUntil - relay.now();
    return left > 0 ? Math.ceil(left / 1000) : 0;
}

/**
 * Replace the secret values in a URL so it can be logged
 */
export function redactUrl(url: URL | string): string {
    const parsed = new URL(String(url));
    for (const name of ['api', 'key', 'token']) {
        if (parsed.searchParams.has(name)) parsed.searchParams.set(name, '***');
    }
    return parsed.toString();
}

/**
 * Log at most once a minute per message key
 */
export function logThrottled(level: 'warn' | 'error', key: string, message: string): void {
    const now = relay.now();
    const last = relay.logged.get(key);
    if (last !== undefined && now - last < LOG_INTERVAL_MS) return;

    relay.logged.set(key, now);
    if (level === 'warn') {
        console.warn(message);
    } else {
        console.error(message);
    }
}

export function userAgent(apiUrl: string): string {
    return `CloudTAK/${pkg.version} (+${apiUrl})`;
}

/**
 * Detect PNG or WebP from the leading bytes. Returns null for anything else.
 */
export function sniffImageType(body: Buffer): TileType | null {
    if (body.byteLength >= PNG_MAGIC.byteLength && body.subarray(0, PNG_MAGIC.byteLength).equals(PNG_MAGIC)) {
        return 'image/png';
    }

    if (
        body.byteLength >= WEBP_MIN_BYTES
        && body.subarray(0, 4).toString('latin1') === 'RIFF'
        && body.subarray(8, 12).toString('latin1') === 'WEBP'
        && WEBP_CHUNKS.includes(body.subarray(12, 16).toString('latin1'))
    ) {
        return 'image/webp';
    }

    return null;
}

function unavailable(url: URL, reason: string): Err {
    logThrottled('warn', `upstream:${reason}`, `Weather relay: upstream failed (${reason}) for ${redactUrl(url)}`);
    return new Err(502, null, UNAVAILABLE, false);
}

function parseRetryAfter(raw: string | null): number | null {
    if (!raw || !/^[0-9]{1,6}$/.test(raw.trim())) return null;
    return Number(raw.trim());
}

function parseSnapshotHeader(raw: string | null): number | null {
    if (raw === null || !/^[0-9]{1,12}$/.test(raw.trim())) return null;
    return Number(raw.trim());
}

async function readBody(res: { body: ReadableStream<Uint8Array> | null }, maxBytes = MAX_TILE_BYTES): Promise<Buffer | null> {
    if (!res.body) return Buffer.alloc(0);

    const reader = res.body.getReader();
    const chunks: Buffer[] = [];
    let total = 0;

    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;

        total += value.byteLength;
        if (total > maxBytes) {
            await reader.cancel().catch(() => undefined);
            return null;
        }

        chunks.push(Buffer.from(value));
    }

    return Buffer.concat(chunks, total);
}

/**
 * Fetch one tile from the weather proxy.
 *
 * Returns the upstream status for any non-200 answer that the caller maps
 * itself. Throws a 502 for everything that is not a usable PNG or WebP tile:
 * network errors, timeouts, SSRF blocks, redirects, wrong content type,
 * unrecognised image bytes and oversize bodies. The weather-proxy labels every
 * tile image/png, including WebP clouds tiles, so the type returned in
 * `contentType` comes from the body bytes, not from the header.
 */
export async function fetchUpstream(url: URL, agent = `CloudTAK/${pkg.version}`): Promise<UpstreamResponse> {
    let res;
    try {
        res = await fetch(url, {
            headers: {
                'user-agent': agent,
                'accept': 'image/png, image/webp',
            },
            redirect: 'manual',
            timeout: relay.upstreamTimeoutMs,
            safeUrlAllow: upstreamAllowForTests,
        });
    } catch (err) {
        const name = err instanceof Error ? err.name : 'Error';
        const status = err instanceof Err ? `blocked ${err.status}` : name;
        throw unavailable(url, status);
    }

    const headers = res.headers;
    const declared = headers.get('content-type');
    const result: UpstreamResponse = {
        status: res.status,
        contentType: null,
        body: null,
        fallback: headers.has('x-weather-fallback'),
        error: headers.has('x-weather-error'),
        cacheControl: headers.get('cache-control'),
        retryAfterS: parseRetryAfter(headers.get('retry-after')),
        snapshot: parseSnapshotHeader(headers.get('x-weather-snapshot')),
    };

    if (res.status >= 300 && res.status < 400) {
        await res.body?.cancel().catch(() => undefined);
        throw unavailable(url, `redirect ${res.status}`);
    }

    if (res.status !== 200) {
        await res.body?.cancel().catch(() => undefined);
        return result;
    }

    if (!declared || !declared.toLowerCase().startsWith('image/')) {
        await res.body?.cancel().catch(() => undefined);
        throw unavailable(url, 'content-type');
    }

    let body: Buffer | null;
    try {
        body = await readBody(res as unknown as { body: ReadableStream<Uint8Array> | null });
    } catch (err) {
        throw unavailable(url, err instanceof Error ? err.name : 'body');
    }

    if (body === null) throw unavailable(url, 'too large');

    const type = sniffImageType(body);
    if (!type) throw unavailable(url, 'not an image');

    result.contentType = type;
    result.body = body;
    return result;
}

/**
 * Fetch a small JSON document from the weather proxy (the snapshot endpoint).
 *
 * Uses the same SSRF-safe fetch, timeout and redirect rules as `fetchUpstream`.
 * Returns the status for every answer; `json` is null unless the status is 200
 * and the body (at most 4096 bytes) is valid JSON. Throws a 502 for network
 * errors, timeouts, SSRF blocks and redirects. The URL carries the API key and
 * is only ever logged through `redactUrl`.
 */
export async function fetchJsonUpstream(
    url: URL,
    agent = `CloudTAK/${pkg.version}`,
): Promise<{ status: number; json: unknown; retryAfterS: number | null }> {
    let res;
    try {
        res = await fetch(url, {
            headers: {
                'user-agent': agent,
                'accept': 'application/json',
            },
            redirect: 'manual',
            timeout: relay.upstreamTimeoutMs,
            safeUrlAllow: upstreamAllowForTests,
        });
    } catch (err) {
        const name = err instanceof Error ? err.name : 'Error';
        const status = err instanceof Err ? `blocked ${err.status}` : name;
        throw unavailable(url, status);
    }

    const retryAfterS = parseRetryAfter(res.headers.get('retry-after'));

    if (res.status >= 300 && res.status < 400) {
        await res.body?.cancel().catch(() => undefined);
        throw unavailable(url, `redirect ${res.status}`);
    }

    if (res.status !== 200) {
        await res.body?.cancel().catch(() => undefined);
        return { status: res.status, json: null, retryAfterS };
    }

    let body: Buffer | null;
    try {
        body = await readBody(res as unknown as { body: ReadableStream<Uint8Array> | null }, MAX_JSON_BYTES);
    } catch (err) {
        throw unavailable(url, err instanceof Error ? err.name : 'body');
    }

    if (body === null) return { status: 200, json: null, retryAfterS };

    try {
        return { status: 200, json: JSON.parse(body.toString('utf8')) as unknown, retryAfterS };
    } catch {
        return { status: 200, json: null, retryAfterS };
    }
}

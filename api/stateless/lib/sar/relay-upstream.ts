import fs from 'node:fs';
import { fetch } from '@tak-ps/node-safeurl';
import { FixedWindowLimiter } from '../weather/relay-limiter.js';
import { upstreamAllowForTests, __resetWarned } from './relay-config.js';
import type { SarConfig } from './relay-config.js';
import type { TarrUpstreamBody, UpstreamBody } from './relay-request.js';
import { HOURS, RADIUS } from './relay-request.js';

export { upstreamAllowForTests };

const pkg = JSON.parse(String(fs.readFileSync(new URL('../../../package.json', import.meta.url))));

/** The engine can take about a minute on a cold start. Stay above that. */
export const UPSTREAM_TIMEOUT_MS = 70000;
export const MAX_UPSTREAM_BYTES = 10 * 1024 * 1024;
export const STATUS_LIMIT = 60;
export const RETRY_AFTER_TIMEOUT_S = 30;
export const MAX_MESSAGE_CHARS = 300;

export const UNAVAILABLE = 'SAR service unavailable';
export const TIMED_OUT = 'SAR service timed out';
export const ANALYSIS_FAILED = 'Analysis failed. Try again, or try a smaller area.';
export const REJECTED = 'The SAR service rejected the request';
export const TOO_LARGE = 'Request too large';

/** The only keys of an engine answer that reach the browser */
export const RESULT_KEYS = [
    'status',
    'mode',
    'contours',
    'parameters',
    'bbox',
    'warnings',
    'data',
    'attribution',
    'disclaimer',
    'timings_s',
] as const;

/** The TARR answer also carries the calibration block */
export const RESULT_KEYS_TARR = [...RESULT_KEYS, 'calibration'] as const;

export type RelayMode = 'travel-time' | 'tarr';
export type EngineRoute = '/travel-time' | '/tarr';

const LOG_INTERVAL_MS = 60000;

export type FailureKind = 'timeout' | 'network' | 'blocked' | 'redirect' | 'too-large';

export interface EngineResult {
    /** HTTP status of the engine answer; null when there was no usable answer */
    status: number | null;
    /** Parsed JSON body (only read for 200 and 422); null when absent or not JSON */
    json: unknown;
    /** Set when the call failed before a usable answer arrived */
    failure: FailureKind | null;
}

export interface MappedError {
    status: number;
    message: string;
    retryAfterS?: number;
    /** Extra fields for the error body */
    extra?: Record<string, number | string>;
}

export interface MappedOk {
    ok: true;
    body: Record<string, unknown>;
}

export interface MappedFail {
    ok: false;
    error: MappedError;
}

export type Mapped = MappedOk | MappedFail;

export interface RelayOptions {
    now?: () => number;
    upstreamTimeoutMs?: number;
}

export interface RelayRuntime {
    now: () => number;
    upstreamTimeoutMs: number;
    /** Calculations (travel-time and TARR share it) per user per minute (the limit comes from SAR_RATE_LIMIT at each hit) */
    calc: FixedWindowLimiter;
    /** Status calls per user per minute */
    status: FixedWindowLimiter;
    logged: Map<string, number>;
}

function create(opts: RelayOptions): RelayRuntime {
    const runtime: RelayRuntime = {
        now: opts.now ?? (() => Date.now()),
        upstreamTimeoutMs: opts.upstreamTimeoutMs ?? UPSTREAM_TIMEOUT_MS,
        calc: undefined as unknown as FixedWindowLimiter,
        status: undefined as unknown as FixedWindowLimiter,
        logged: new Map(),
    };

    const now = () => runtime.now();
    runtime.calc = new FixedWindowLimiter({ windowMs: 60000, now });
    runtime.status = new FixedWindowLimiter({ windowMs: 60000, now });

    return runtime;
}

export const relay: RelayRuntime = create({});

/**
 * Test hook: replace the limiters, the log memory and the warning memory.
 * Production code never calls this.
 */
export function __resetForTests(opts: RelayOptions = {}): void {
    for (const limiter of [relay.calc, relay.status]) limiter.stop();

    Object.assign(relay, create(opts));
    __resetWarned();
}

/**
 * Remove secrets from text that is about to be logged: the configured key,
 * `x-api-key` values and bearer tokens
 */
export function redact(text: string, key?: string | null): string {
    let out = String(text);
    if (key) out = out.split(key).join('***');
    out = out.replace(/(x-api-key["']?\s*[:=]\s*["']?)[^\s"',;]+/gi, '$1***');
    out = out.replace(/(Bearer\s+)[A-Za-z0-9._~+/=-]+/gi, '$1***');
    return out;
}

/**
 * Log at most once a minute per message key
 */
export function logThrottled(level: 'warn' | 'error', key: string, message: string): void {
    const now = relay.now();
    const last = relay.logged.get(key);
    if (last !== undefined && now - last < LOG_INTERVAL_MS) return;

    relay.logged.set(key, now);
    const text = redact(message);
    if (level === 'warn') {
        console.warn(text);
    } else {
        console.error(text);
    }
}

export function userAgent(apiUrl: string): string {
    return `CloudTAK/${pkg.version} (+${apiUrl})`;
}

function classify(err: unknown): FailureKind {
    const name = err instanceof Error ? err.name : '';
    if (name === 'TimeoutError' || name === 'AbortError') return 'timeout';
    // node-safeurl refuses an unsafe URL with a batch-error (name PublicError)
    if (name === 'PublicError') return 'blocked';
    return 'network';
}

function fail(failure: FailureKind, err?: unknown): EngineResult {
    // Only a class name is logged: error messages can carry the URL
    const name = err instanceof Error ? err.name : failure;
    logThrottled('warn', `upstream:${failure}`, `SAR relay: upstream call failed (${failure}, ${name})`);
    return { status: null, json: null, failure };
}

async function readBody(res: { body: ReadableStream<Uint8Array> | null }, maxBytes = MAX_UPSTREAM_BYTES): Promise<Buffer | null> {
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
 * Call the SAR engine. Never throws: every failure is reported in `failure`.
 * The body is parsed only for 200 and 422 answers; any other answer is
 * reported by its status alone and its body is discarded.
 */
export async function callEngine(
    cfg: SarConfig,
    body: UpstreamBody | TarrUpstreamBody,
    agent = `CloudTAK/${pkg.version}`,
    route: EngineRoute = '/travel-time',
): Promise<EngineResult> {
    if (!cfg.baseUrl || !cfg.key) return fail('network');

    let res;
    try {
        res = await fetch(new URL(`${cfg.baseUrl}${route}`), {
            method: 'POST',
            headers: {
                'x-api-key': cfg.key,
                'content-type': 'application/json',
                'accept': 'application/json',
                'user-agent': agent,
            },
            body: JSON.stringify(body),
            redirect: 'manual',
            timeout: relay.upstreamTimeoutMs,
            safeUrlAllow: upstreamAllowForTests,
        });
    } catch (err) {
        return fail(classify(err), err);
    }

    if (res.status >= 300 && res.status < 400) {
        await res.body?.cancel().catch(() => undefined);
        return fail('redirect');
    }

    if (res.status !== 200 && res.status !== 422) {
        await res.body?.cancel().catch(() => undefined);
        return { status: res.status, json: null, failure: null };
    }

    let raw: Buffer | null;
    try {
        raw = await readBody(res as unknown as { body: ReadableStream<Uint8Array> | null });
    } catch (err) {
        return fail(classify(err), err);
    }

    if (raw === null) return fail('too-large');

    try {
        return { status: res.status, json: JSON.parse(raw.toString('utf8')) as unknown, failure: null };
    } catch {
        return { status: res.status, json: null, failure: null };
    }
}

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Keep a 422 message readable: control characters removed, at most 300 characters
 */
export function sanitizeMessage(raw: string): string {
    // eslint-disable-next-line no-control-regex
    return raw.replace(/[\u0000-\u001F\u007F-\u009F]/g, '').trim().slice(0, MAX_MESSAGE_CHARS);
}

/**
 * A suggested radius is kept only when it is a finite number in the engine's
 * radius range, rounded to one decimal
 */
export function sanitizeSuggestedRadius(raw: unknown): number | undefined {
    if (typeof raw !== 'number' || !Number.isFinite(raw)) return undefined;
    if (raw < RADIUS[0] || raw > RADIUS[1]) return undefined;
    return Math.round(raw * 10) / 10;
}

/**
 * A suggested maximum band length is kept only when it is a finite number in
 * the engine's band range, rounded to two decimals
 */
export function sanitizeSuggestedHours(raw: unknown): number | undefined {
    if (typeof raw !== 'number' || !Number.isFinite(raw)) return undefined;
    if (raw < HOURS[0] || raw > HOURS[1]) return undefined;
    return Math.round(raw * 100) / 100;
}
/**
 * An error code is a short machine readable token; anything else is dropped
 */
export function sanitizeCode(raw: unknown): string | undefined {
    if (typeof raw !== 'string') return undefined;
    return /^[a-z][a-z0-9_]{0,63}$/.test(raw) ? raw : undefined;
}
function validResult(json: unknown, mode: RelayMode): json is Record<string, unknown> {
    if (!isObject(json)) return false;
    if (json.status !== 'ok' || json.mode !== mode) return false;
    const contours = json.contours;
    return isObject(contours) && contours.type === 'FeatureCollection' && Array.isArray(contours.features);
}

function err(status: number, message: string, more: Partial<MappedError> = {}): Mapped {
    return { ok: false, error: { status, message, ...more } };
}

/**
 * Turn an engine answer into the relay answer. Upstream bodies and messages
 * are never forwarded, except the whitelisted keys of a 200 and the sanitised
 * message of a 422.
 */
export function mapUpstream(result: EngineResult, mode: RelayMode = 'travel-time'): Mapped {
    if (result.failure === 'timeout') return err(504, TIMED_OUT, { retryAfterS: RETRY_AFTER_TIMEOUT_S });
    if (result.failure !== null || result.status === null) return err(502, UNAVAILABLE);

    switch (result.status) {
        case 200: {
            if (!validResult(result.json, mode)) return err(502, UNAVAILABLE);

            const body: Record<string, unknown> = {};
            for (const name of mode === 'tarr' ? RESULT_KEYS_TARR : RESULT_KEYS) {
                if (result.json[name] !== undefined) body[name] = result.json[name];
            }
            return { ok: true, body };
        }
        case 422: {
            const json = result.json;
            if (!isObject(json) || typeof json.message !== 'string') return err(502, UNAVAILABLE);

            const message = sanitizeMessage(json.message);
            if (!message) return err(502, UNAVAILABLE);

            // Only these fields are forwarded; each is type-checked and dropped when invalid
            const extra: Record<string, number | string> = {};
            const code = sanitizeCode(json.code);
            if (code !== undefined) extra.code = code;
            const radius = sanitizeSuggestedRadius(json.suggested_radius_km);
            if (radius !== undefined) extra.suggested_radius_km = radius;
            const hours = sanitizeSuggestedHours(json.suggested_max_hours);
            if (hours !== undefined) extra.suggested_max_hours = hours;
            return err(422, message, Object.keys(extra).length ? { extra } : {});
        }
        case 400:
            return err(400, REJECTED);
        case 413:
            return err(413, TOO_LARGE);
        case 401:
        case 403:
            logThrottled('error', 'upstream:auth', 'SAR relay: the SAR service rejected the configured API key');
            return err(502, UNAVAILABLE);
        case 500:
            return err(500, ANALYSIS_FAILED);
        case 502:
        case 503:
        case 504:
            return err(504, TIMED_OUT, { retryAfterS: RETRY_AFTER_TIMEOUT_S });
        default:
            return err(502, UNAVAILABLE);
    }
}

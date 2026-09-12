import Err from '@openaddresses/batch-error';
import { fetch, Headers, Response } from 'undici';
import { isSafeUrl } from '@tak-ps/node-safeurl';
import type ConfigStateless from '../../config.js';

const REQUEST_BODY_LIMIT = 256 * 1024;
const RESPONSE_BODY_LIMIT = 1024 * 1024;
const IMAGE_RESPONSE_BODY_LIMIT = 10 * 1024 * 1024;
export const IMAGE_CACHE_SECONDS = 3600;
export const REQUEST_TIMEOUT = 15_000;

export const ALLOWED_METHODS = ['GET', 'POST'] as const;

const FORWARDED_REQUEST_HEADER_ALLOWLIST = new Set([
    'accept',
    'accept-language',
    'authorization',
    'content-type',
    'if-match',
    'if-none-match',
    'user-agent',
    'x-api-key',
    'x-requested-with',
]);

const BLOCKED_REQUEST_HEADERS = new Set([
    'connection',
    'content-length',
    'cookie',
    'host',
    'origin',
    'proxy-authenticate',
    'proxy-authorization',
    'sec-fetch-dest',
    'sec-fetch-mode',
    'sec-fetch-site',
    'te',
    'trailer',
    'transfer-encoding',
    'upgrade',
]);

const BLOCKED_RESPONSE_HEADERS = new Set([
    'connection',
    'keep-alive',
    'proxy-authenticate',
    'proxy-authorization',
    'set-cookie',
    'te',
    'trailer',
    'transfer-encoding',
    'upgrade',
]);

function normalizeWhitelist(raw: string[]): Set<string> {
    const whitelist = new Set<string>();

    for (const entry of raw.map(entry => String(entry).trim()).filter(Boolean)) {
        let url: URL;

        try {
            url = new URL(entry);
        } catch {
            throw new Err(400, null, `Invalid whitelist entry: ${entry}`);
        }

        if (!['http:', 'https:'].includes(url.protocol)) {
            throw new Err(400, null, `Invalid whitelist entry protocol: ${entry}`);
        }

        if (url.username || url.password || url.search || url.hash || (url.pathname && url.pathname !== '/')) {
            throw new Err(400, null, 'Whitelist entries must be origin-only (scheme + host + optional port), without path, query, fragment, or credentials');
        }

        whitelist.add(url.origin);
    }

    return whitelist;
}

export function sanitizeRequestHeaders(input?: Record<string, string>): Headers {
    const headers = new Headers();

    for (const [key, value] of Object.entries(input || {})) {
        const normalized = key.toLowerCase();

        if (normalized.startsWith('x-forwarded-') || normalized === 'x-real-ip') {
            throw new Err(400, null, `Header ${key} is not allowed`);
        }

        if (BLOCKED_REQUEST_HEADERS.has(normalized)) {
            throw new Err(400, null, `Header ${key} is not allowed`);
        }

        if (!FORWARDED_REQUEST_HEADER_ALLOWLIST.has(normalized) && !normalized.startsWith('x-')) {
            throw new Err(400, null, `Header ${key} is not allowed`);
        }

        headers.set(normalized, String(value));
    }

    return headers;
}

export function sanitizeResponseHeaders(headers: Headers): Record<string, string> {
    const sanitized: Record<string, string> = {};

    for (const [key, value] of headers.entries()) {
        if (BLOCKED_RESPONSE_HEADERS.has(key.toLowerCase())) continue;
        sanitized[key] = value;
    }

    return sanitized;
}

export function serializeRequestBody(method: typeof ALLOWED_METHODS[number], headers: Headers, body: unknown): string | undefined {
    if (body === undefined || body === null) return undefined;
    if (method === 'GET') throw new Err(400, null, 'GET proxy requests cannot include a body');

    let serialized: string;
    if (typeof body === 'string') {
        serialized = body;
    } else {
        serialized = JSON.stringify(body);
        if (!headers.has('content-type')) headers.set('content-type', 'application/json');
    }

    if (Buffer.byteLength(serialized) > REQUEST_BODY_LIMIT) {
        throw new Err(400, null, 'Proxy request body exceeds the 256KB limit');
    }

    return serialized;
}

async function readResponseBodyWithLimit(response: Response, limit: number, message = 'Proxy response body exceeds the 1MB limit'): Promise<Buffer> {
    const body = response.body;
    if (!body) return Buffer.alloc(0);

    const reader = body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        if (value) {
            total += value.byteLength;

            if (total > limit) {
                try {
                    await reader.cancel();
                } catch {
                    // Ignore cancellation errors
                }

                throw new Err(400, null, message);
            }

            chunks.push(value);
        }
    }

    const result = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.byteLength;
    }

    return Buffer.from(result.buffer, result.byteOffset, result.byteLength);
}

export async function readUpstreamBody(response: Response): Promise<{
    body: unknown;
    encoding?: 'base64';
}> {
    const declaredLength = response.headers.get('content-length');
    if (declaredLength && Number(declaredLength) > RESPONSE_BODY_LIMIT) {
        throw new Err(400, null, 'Proxy response body exceeds the 1MB limit');
    }

    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    const buf = await readResponseBodyWithLimit(response, RESPONSE_BODY_LIMIT);

    if (contentType.includes('application/json') || contentType.endsWith('+json')) {
        return { body: JSON.parse(buf.toString('utf-8')) };
    }

    if (
        contentType.startsWith('text/')
        || contentType.includes('application/xml')
        || contentType.includes('text/xml')
        || contentType.includes('application/javascript')
        || contentType.includes('application/x-www-form-urlencoded')
    ) {
        return { body: buf.toString('utf-8') };
    }

    return {
        body: buf.toString('base64'),
        encoding: 'base64',
    };
}

export function parseProxyUrl(raw: string): URL {
    let parsed: URL;
    try {
        parsed = new URL(raw);
    } catch {
        throw new Err(400, null, 'Invalid proxy URL');
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Err(400, null, 'Proxy only supports http and https URLs');
    }

    if (parsed.username || parsed.password) {
        throw new Err(400, null, 'Proxy URLs cannot include embedded credentials');
    }

    return parsed;
}

export async function proxyWhitelist(config: ConfigStateless): Promise<Set<string>> {
    const whitelistRaw = await config.models.Setting.typed('proxy::whitelist', []);
    return normalizeWhitelist(whitelistRaw.value);
}

export async function resolveProxyTarget(config: ConfigStateless, raw: string): Promise<URL> {
    const parsed = parseProxyUrl(raw);

    const enabled = await config.models.Setting.typed('proxy::enabled', false);
    if (!enabled.value) {
        throw new Err(403, null, 'Proxy is disabled');
    }

    const whitelist = await proxyWhitelist(config);

    if (!whitelist.size) {
        throw new Err(403, null, 'No proxy origins have been configured');
    }

    if (!whitelist.has(parsed.origin)) {
        throw new Err(403, null, `Proxy origin ${parsed.origin} is not allowed`);
    }

    const { safe, reason } = await isSafeUrl(parsed.href, { allow: [...whitelist] });
    if (!safe) throw new Err(403, null, `Blocked proxy URL: ${reason}`);

    return parsed;
}

export async function fetchProxyImage(config: ConfigStateless, raw: string): Promise<{ contentType: string; body: Buffer }> {
    const parsed = parseProxyUrl(raw);

    const whitelist = await proxyWhitelist(config);
    const { safe, reason } = await isSafeUrl(parsed.href, { allow: [...whitelist] });
    if (!safe) throw new Err(403, null, `Blocked proxy URL: ${reason}`);

    const upstream = await fetch(parsed, {
        method: 'GET',
        headers: { accept: 'image/*' },
        redirect: 'manual',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    });

    if (!upstream.ok) {
        throw new Err(502, null, `Proxy image upstream returned ${upstream.status}`);
    }

    const contentType = (upstream.headers.get('content-type') || '').toLowerCase();
    if (!contentType.startsWith('image/')) {
        throw new Err(400, null, 'Proxy image URL did not return an image');
    }

    const declaredLength = upstream.headers.get('content-length');
    if (declaredLength && Number(declaredLength) > IMAGE_RESPONSE_BODY_LIMIT) {
        throw new Err(400, null, 'Proxy image exceeds the 10MB limit');
    }

    const body = await readResponseBodyWithLimit(upstream, IMAGE_RESPONSE_BODY_LIMIT, 'Proxy image exceeds the 10MB limit');

    return { contentType, body };
}

import { lookup } from 'node:dns/promises';
import net from 'node:net';
import { Type } from '@sinclair/typebox'
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import { fetch, Headers } from 'undici';
import Auth from '../lib/auth.js';
import Config from '../lib/config.js';

const REQUEST_BODY_LIMIT = 256 * 1024;
const RESPONSE_BODY_LIMIT = 1024 * 1024;
const REQUEST_TIMEOUT = 15_000;

const ALLOWED_METHODS = ['GET', 'POST'] as const;

const FORWARDED_REQUEST_HEADER_ALLOWLIST = new Set([
    'accept',
    'accept-language',
    'authorization',
    'content-type',
    'if-match',
    'if-none-match',
    'user-agent',
    'x-api-key',
    'x-requested-with'
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
    'upgrade'
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
    'upgrade'
]);

function parseWhitelist(raw: string[]): Set<string> {
    const whitelist = new Set<string>();

    if (!raw.length) return whitelist;

    const entries = raw;

    for (const entry of entries) {
        try {
            const url = new URL(entry);
            if (!['http:', 'https:'].includes(url.protocol)) continue;
            whitelist.add(url.origin);
        } catch {
            continue;
        }
    }

    return whitelist;
}

function isPrivateIPv4(address: string): boolean {
    const octets = address.split('.').map(Number);
    const [a, b] = octets;

    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a === 198 && (b === 18 || b === 19)) return true;

    return false;
}

function isPrivateIPv6(address: string): boolean {
    const normalized = address.toLowerCase();

    if (normalized === '::1' || normalized === '::') return true;
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
    if (normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')) return true;

    return false;
}

function isPrivateAddress(address: string): boolean {
    const family = net.isIP(address);

    if (family === 4) return isPrivateIPv4(address);
    if (family === 6) return isPrivateIPv6(address);

    return true;
}

async function assertPublicTarget(config: Config, url: URL): Promise<void> {
    if (config.StackName === 'test') return;

    const hostname = url.hostname.toLowerCase();
    if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
        throw new Err(403, null, 'Proxy target must resolve to a public address');
    }

    const addresses = await lookup(hostname, { all: true, verbatim: true });
    if (!addresses.length) throw new Err(403, null, 'Proxy target could not be resolved');

    for (const address of addresses) {
        if (isPrivateAddress(address.address)) {
            throw new Err(403, null, 'Proxy target must resolve to a public address');
        }
    }
}

function sanitizeRequestHeaders(input?: Record<string, string>): Headers {
    const headers = new Headers();

    for (const [key, value] of Object.entries(input || {})) {
        const normalized = key.toLowerCase();

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

function sanitizeResponseHeaders(headers: Headers): Record<string, string> {
    const sanitized: Record<string, string> = {};

    for (const [key, value] of headers.entries()) {
        if (BLOCKED_RESPONSE_HEADERS.has(key.toLowerCase())) continue;
        sanitized[key] = value;
    }

    return sanitized;
}

function normalizeWhitelist(raw: string[]): Set<string> {
    return parseWhitelist(raw.map((entry) => String(entry).trim()).filter(Boolean));
}

function serializeRequestBody(method: typeof ALLOWED_METHODS[number], headers: Headers, body: unknown): string | undefined {
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

async function readUpstreamBody(response: Response): Promise<{
    body: unknown;
    encoding?: 'base64';
}> {
    const declaredLength = response.headers.get('content-length');
    if (declaredLength && Number(declaredLength) > RESPONSE_BODY_LIMIT) {
        throw new Err(400, null, 'Proxy response body exceeds the 1MB limit');
    }

    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    const buf = Buffer.from(await response.arrayBuffer());

    if (buf.byteLength > RESPONSE_BODY_LIMIT) {
        throw new Err(400, null, 'Proxy response body exceeds the 1MB limit');
    }

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
        encoding: 'base64'
    };
}

export default async function router(schema: Schema, config: Config) {
    await schema.post('/proxy', {
        name: 'Proxy Request',
        group: 'Proxy',
        description: 'Make a proxied outbound HTTP request to an admin-allowed origin',
        body: Type.Object({
            url: Type.String(),
            method: Type.Optional(Type.String({
                enum: [...ALLOWED_METHODS],
                default: 'GET'
            })),
            headers: Type.Optional(Type.Record(Type.String(), Type.String())),
            body: Type.Optional(Type.Any())
        }),
        res: Type.Object({
            status: Type.Integer(),
            headers: Type.Record(Type.String(), Type.String()),
            body: Type.Any(),
            encoding: Type.Optional(Type.String({ enum: ['base64'] })),
        })
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const parsed = new URL(req.body.url);
            if (!['http:', 'https:'].includes(parsed.protocol)) {
                throw new Err(400, null, 'Proxy only supports http and https URLs');
            }

            if (parsed.username || parsed.password) {
                throw new Err(400, null, 'Proxy URLs cannot include embedded credentials');
            }

            const enabled = await config.models.Setting.typed('proxy::enabled', false);
            if (!enabled.value) {
                throw new Err(403, null, 'Proxy is disabled');
            }

            const whitelistRaw = await config.models.Setting.typed('proxy::whitelist', []);
            const whitelist = normalizeWhitelist(whitelistRaw.value);

            if (!whitelist.size) {
                throw new Err(403, null, 'No proxy origins have been configured');
            }

            if (!whitelist.has(parsed.origin)) {
                throw new Err(403, null, `Proxy origin ${parsed.origin} is not allowed`);
            }

            await assertPublicTarget(config, parsed);

            const method = String(req.body.method || 'GET').toUpperCase() as typeof ALLOWED_METHODS[number];
            if (!ALLOWED_METHODS.includes(method)) {
                throw new Err(400, null, 'Proxy method must be GET or POST');
            }

            const headers = sanitizeRequestHeaders(req.body.headers);
            const body = serializeRequestBody(method, headers, req.body.body);

            const upstream = await fetch(parsed, {
                method,
                headers,
                body,
                redirect: 'manual',
                signal: AbortSignal.timeout(REQUEST_TIMEOUT)
            });

            const response = await readUpstreamBody(upstream);
            const responseHeaders = sanitizeResponseHeaders(upstream.headers);

            console.info(JSON.stringify({
                type: 'proxy',
                username: user.email,
                method,
                url: parsed.toString(),
                status: upstream.status
            }));

            res.json({
                status: upstream.status,
                headers: responseHeaders,
                body: response.body,
                ...(response.encoding ? { encoding: response.encoding } : {})
            });
        } catch (err) {
            Err.respond(err, res);
        }
    });
}
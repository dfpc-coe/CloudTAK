import { Type } from '@sinclair/typebox';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import { fetch } from 'undici';
import Auth from '../../common/auth.js';
import type ConfigStateless from '../config.js';
import {
    ALLOWED_METHODS,
    IMAGE_CACHE_SECONDS,
    REQUEST_TIMEOUT,
    fetchProxyImage,
    readUpstreamBody,
    resolveProxyTarget,
    sanitizeRequestHeaders,
    sanitizeResponseHeaders,
    serializeRequestBody,
} from '../lib/control/proxy.js';

export default async function router(schema: Schema, config: ConfigStateless) {
    await schema.post('/proxy', {
        name: 'Proxy Request',
        group: 'Proxy',
        description: 'Make a proxied outbound HTTP request to an admin-allowed origin',
        body: Type.Object({
            url: Type.String(),
            method: Type.Optional(Type.String({
                enum: [...ALLOWED_METHODS],
                default: 'GET',
            })),
            headers: Type.Optional(Type.Record(Type.String(), Type.String())),
            body: Type.Optional(Type.Any()),
        }),
        res: Type.Object({
            status: Type.Integer(),
            headers: Type.Record(Type.String(), Type.String()),
            body: Type.Any(),
            encoding: Type.Optional(Type.String({ enum: ['base64'] })),
        }),
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const parsed = await resolveProxyTarget(config, req.body.url);

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
                signal: AbortSignal.timeout(REQUEST_TIMEOUT),
            });

            const response = await readUpstreamBody(upstream);
            const responseHeaders = sanitizeResponseHeaders(upstream.headers);

            console.info(JSON.stringify({
                type: 'proxy',
                username: user.email,
                method,
                url: parsed.origin + parsed.pathname,
                status: upstream.status,
            }));

            res.json({
                status: upstream.status,
                headers: responseHeaders,
                body: response.body,
                ...(response.encoding ? { encoding: response.encoding } : {}),
            });
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.get('/proxy/image', {
        name: 'Proxy Image',
        group: 'Proxy',
        description: 'Stream a remote image through CloudTAK so it can be displayed under the Content-Security-Policy. Any public origin is allowed; admin whitelisted proxy origins are additionally trusted',
        query: Type.Object({
            url: Type.String({ description: 'Absolute http(s) URL of the image to proxy' }),
            token: Type.Optional(Type.String()),
        }),
    }, async (req, res) => {
        try {
            await Auth.is_auth(config, req, { token: true });

            const { contentType, body } = await fetchProxyImage(config, req.query.url);

            res.setHeader('Content-Type', contentType);
            res.setHeader('Content-Length', body.byteLength);
            res.setHeader('Content-Disposition', 'inline');
            res.setHeader('X-Content-Type-Options', 'nosniff');
            res.setHeader('Cache-Control', `private, max-age=${IMAGE_CACHE_SECONDS}`);
            res.end(body);
        } catch (err) {
            Err.respond(err, res);
        }
    });
}

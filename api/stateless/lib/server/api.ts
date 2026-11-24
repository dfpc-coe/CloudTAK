import fs from 'node:fs';
import path from 'node:path';
import cors from 'cors';
import express from 'express';
import history, { Context } from 'connect-history-api-fallback';
import morgan from 'morgan';
import Schema from '@openaddresses/batch-schema';
import '../../../common/error.js';
import { StandardResponse } from '../../../common/types.js';
import { identityOf, securityHandlers, SECURITY_SCHEMES } from '../../../common/auth.js';
import type Config from '../../../common/config.js';

const pkg = JSON.parse(String(fs.readFileSync(new URL('../../../package.json', import.meta.url))));

export default async function buildApi(config: Config): Promise<express.Application> {
    const app = express();

    // Resolve the client address from X-Forwarded-For set by nginx and any private load balancer
    app.set('trust proxy', 'loopback, linklocal, uniquelocal');

    morgan.token('remote-user', req => identityOf(req));

    const schema = new Schema(express.Router(), {
        prefix: '/api',
        logging: {
            skip: function (req, res) {
                return res.statusCode <= 399 && res.statusCode >= 200;
            },
        },
        limit: 50,
        error: {
            400: StandardResponse,
            401: StandardResponse,
            403: StandardResponse,
            404: StandardResponse,
            500: StandardResponse,
        },
        openapi: {
            info: {
                title: 'CloudTAK API',
                version: pkg.version,
            },
            components: {
                securitySchemes: SECURITY_SCHEMES,
            },
            security: [{
                bearerAuth: [],
            }],
        },
        securityHandlers: securityHandlers(config),
    });

    app.disable('x-powered-by');
    app.use(cors({
        origin: (origin, callback) => {
            if (!origin || origin === 'null') {
                callback(null, true);
            } else {
                callback(null, origin);
            }
        },
        exposedHeaders: [
            'Content-Disposition',
        ],
        allowedHeaders: [
            'Content-Type',
            'Content-Length',
            'User-Agent',
            'Authorization',
            'MissionAuthorization',
            'x-requested-with',
        ],
        credentials: true,
    }));

    app.get('/api', (req, res) => {
        res.json({
            version: pkg.version,
        });
    });

    app.use('/api/scim', express.json({ type: 'application/scim+json', limit: '50mb' }));
    app.use('/api', schema.router);

    await schema.load(
        new URL('../../routes/', import.meta.url),
        config,
        {
            silent: !!config.silent,
        },
    );

    app.use(history({
        rewrites: [{
            from: /.*\/js\/.*$/,
            to(context: Context) {
                if (!context.parsedUrl.pathname) context.parsedUrl.pathname = '';
                return context.parsedUrl.pathname.replace(/.*\/js\//, '/js/');
            },
        }, {
            from: /.*$/,
            to(context: Context) {
                if (!context.parsedUrl.pathname) context.parsedUrl.pathname = '';
                if (!context.parsedUrl.path) context.parsedUrl.path = '';
                const parse = path.parse(context.parsedUrl.path);
                if (parse.ext) {
                    return context.parsedUrl.pathname;
                } else {
                    return '/';
                }
            },
        }],
    }));

    app.use(express.static('../app/dist'));

    return app;
}

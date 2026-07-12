import fs from 'node:fs';
import path from 'node:path';
import cors from 'cors';
import express from 'express';
import history, { Context } from 'connect-history-api-fallback';
import Schema from '@openaddresses/batch-schema';
import { StandardResponse } from '../types.js';
import type Config from '../config.js';

const pkg = JSON.parse(String(fs.readFileSync(new URL('../../package.json', import.meta.url))));

export default async function buildApi(config: Config): Promise<express.Application> {
    const app = express();

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
                securitySchemes: {
                    bearerAuth: {
                        type: 'http',
                        scheme: 'bearer',
                        bearerFormat: 'JWT',
                    },
                },
            },
            security: [{
                bearerAuth: [],
            }],
        },
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

    app.use('/api', schema.router);

    await schema.api();

    await schema.load(
        new URL('../../routes/', import.meta.url),
        config,
        {
            silent: !!config.silent,
        },
    );

    app.use('/fonts', express.static('fonts/'));

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

    app.use(express.static('web/dist'));

    return app;
}

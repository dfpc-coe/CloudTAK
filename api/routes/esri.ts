import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import Config from '../lib/config.js';
import { Response } from 'express';
import { AuthRequest } from '@tak-ps/blueprint-login';
import {
    EsriType,
    EsriAuth,
    EsriBase,
    EsriProxyPortal,
    EsriProxyServer,
    EsriProxyLayer
} from '../lib/esri.js';

export default async function router(schema: any, config: Config) {
    await schema.post('/esri', {
        name: 'Validate & Auth',
        group: 'ESRI',
        auth: 'user',
        description: `
            Helper API to configure ESRI MapServer Layers

            The URL can either be an ESRI Portal URL or a Server URL that doesn't require auth
            or supports token generation
        `,
        body: {
            type: "object",
            additionalProperties: false,
            required: [ "url" ],
            properties: {
                url: { "type": "string" },
                username: { "type": "string" },
                password: { "type": "string" },
                sinkid: { "type": "integer" },
            }
        },
        res: {
            type: "object",
            additionalProperties: false,
            required: ['type', 'base'],
            properties: {
                type: {
                    type: 'string',
                    enum: [ 'AGOL', 'PORTAL', 'SERVER' ]
                },
                base: { type: 'string' },
                auth: {
                    type: 'object',
                    properties: {
                        token: { type: 'string' },
                        referer: { type: 'string' },
                        expires: { type: 'integer' },
                    }
                }
            }
        }
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(config.models, req, {
                anyResources: true
            });

            try {
                req.body.url = new URL(req.body.url);
            } catch (err) {
                throw new Err(400, null, err.message);
            }

            if (req.body.sinkid) {
                const sink: any = await config.models.ConnectionSink.from(parseInt(req.body.sinkid));
                req.body.username = sink.body.username;
                req.body.password = sink.body.password;
            }

            let base;
            if (req.body.username && req.body.password) {
                base = await EsriBase.from(req.body.url, {
                    username: req.body.username,
                    password: req.body.password,
                    referer: config.API_URL,
                });
            } else {
                base = await EsriBase.from(req.body.url);
            }

            return res.json({
                type: base.type,
                base: base.base,
                auth: base.token
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.get('/esri/portal', {
        name: 'Portal Meta',
        group: 'ESRI',
        auth: 'user',
        description: `
            Helper API to configure ESRI MapServers
            Return Portal Data
        `,
        query: {
            type: "object",
            additionalProperties: false,
            required: [ 'portal' ],
            properties: {
                portal: { type: 'string' },
                token: { type: 'string' },
                expires: { type: 'string' },
            }
        },
        res: { type: 'object' }
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(config.models, req, {
                anyResources: true
            });

            const base = new EsriBase(String(req.query.portal));
            if (req.query.token && req.query.expires) {
                base.token = {
                    token: String(req.query.token),
                    expires: Number(req.query.expires),
                    referer: config.API_URL
                }
            }

            const portal = new EsriProxyPortal(base);
            return res.json(await portal.getPortal());
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.get('/esri/portal/content', {
        name: 'Portal Content',
        group: 'ESRI',
        auth: 'user',
        description: `
            Helper API to configure ESRI MapServers
            Return Portal Content
        `,
        query: {
            type: "object",
            additionalProperties: false,
            required: [ "portal" ],
            properties: {
                portal: { type: 'string' },
                token: { type: 'string' },
                expires: { type: 'string' },
                title: { type: "string" },
            }
        },
        res: { type: "object" }
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(config.models, req, {
                anyResources: true
            });

            const base = new EsriBase(String(req.query.portal));
            if (req.query.token && req.query.expires) {
                base.token = {
                    token: String(req.query.token),
                    expires: Number(req.query.expires),
                    referer: config.API_URL
                }
            }

            const portal = new EsriProxyPortal(base);

            const content = await portal.getContent({
                title: req.query.title ? String(req.query.title) : undefined
            });

            return res.json(content);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.post('/esri/portal/service', {
        name: 'Create Service',
        group: 'ESRI',
        auth: 'user',
        description: 'Create Service to store Feature Layers',
        query: {
            type: 'object',
            required: ['portal', 'token', 'expires'],
            properties: {
                portal: { type: 'string' },
                token: { type: 'string' },
                expires: { type: 'string' },
            }
        },
        body: {
            type: 'object',
            required: ['name'],
            properties: {
                name: { type: 'string' }
            }
        },
        res: {
            type: 'object'
        }
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(config.models, req, {
                anyResources: true
            });

            const base = new EsriBase(String(req.query.portal));
            base.token = {
                token: String(req.query.token),
                expires: Number(req.query.expires),
                referer: config.API_URL
            }

            const portal = new EsriProxyPortal(base);

            return res.json(await portal.createService(req.body.name));
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.get('/esri/portal/server', {
        name: 'List Servers',
        group: 'ESRI',
        auth: 'user',
        description: `
            Helper API to configure ESRI MapServers
            List Servers associates with a given portal
        `,
        query: {
            type: "object",
            additionalProperties: false,
            required: [ "portal", "token" ],
            properties: {
                portal: { type: "string" },
                token: { type: 'string' },
                expires: { type: 'string' },
            }
        },
        res: {
            type: "object",
            additionalProperties: false,
            properties: {
                servers: {
                    type: "array",
                    items: { type: "object" }
                },
            }
        }
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(config.models, req, {
                anyResources: true
            });

            const base = new EsriBase(String(req.query.portal));
            if (req.query.token && req.query.expires) {
                base.token = {
                    token: String(req.query.token),
                    expires: Number(req.query.expires),
                    referer: config.API_URL
                }
            }

            const portal = new EsriProxyPortal(base);
            const servers = await portal.getServers();

            return res.json({
                servers: servers.servers
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.get('/esri/server', {
        name: 'List Services',
        group: 'ESRI',
        auth: 'user',
        description: 'Helper API to configure ESRI MapServers - Get Services',
        query: {
            type: 'object',
            required: ['server'],
            properties: {
                server: { type: 'string' },
                token: { type: 'string' },
                expires: { type: 'number' }
            }
        },
        res: {
            type: 'object',
            required: ['folders', 'services'],
            properties: {
                folders: { type: 'array' },
                services: { type: 'array' },
            }
        }
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(config.models, req, {
                anyResources: true
            });

            const base = new EsriBase(String(req.query.server));
            if (req.query.token && req.query.expires) {
                base.token = {
                    token: String(req.query.token),
                    expires: Number(req.query.expires),
                    referer: config.API_URL
                }
            }

            const server = new EsriProxyServer(base);

            const list: any = await server.getList(base.postfix);
            if (!list.folders) list.folders = [];
            if (!list.services) list.services = [];

            return res.json(list);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.post('/esri/server/layer', {
        name: 'Create Layer',
        group: 'ESRI',
        auth: 'user',
        description: 'Create Layer necessary to push CoT data',
        query: {
            type: 'object',
            required: ['server', 'portal', 'token'],
            properties: {
                server: { type: 'string' },
                portal: { type: 'string' },
                token: { type: 'string' }
            }
        },
        res: {
            type: 'object'
        }
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(config.models, req, {
                anyResources: true
            });

            const base = new EsriBase(String(req.query.server));
            if (req.query.token && req.query.expires) {
                base.token = {
                    token: String(req.query.token),
                    expires: Number(req.query.expires),
                    referer: config.API_URL
                }
            }

            const server = new EsriProxyServer(base);

            return res.json(await server.createLayer());
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.delete('/esri/server/layer', {
        name: 'Delete Layer',
        group: 'ESRI',
        auth: 'user',
        description: 'Delete an ESRI Layer',
        query: {
            type: 'object',
            required: ['server', 'portal', 'token'],
            properties: {
                server: { type: 'string' },
                portal: { type: 'string' },
                token: { type: 'string' }
            }
        },
        res: {
            type: 'object'
        }
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(config.models, req, {
                anyResources: true
            });

            if (!String(req.query.server).match(/\/\d+$/)) throw new Err(400, null, 'Could not parse layer ID');

            const url = new URL(String(req.query.server).replace(/\/\d+$/, ''));
            const layer_id = parseInt(String(req.query.server).match(/\/\d+$/)[0].replace('/', ''));

            const base = new EsriBase(String(url));
            if (req.query.token && req.query.expires) {
                base.token = {
                    token: String(req.query.token),
                    expires: Number(req.query.expires),
                    referer: config.API_URL
                }
            }

            const server = new EsriProxyServer(base);

            return res.json(await server.deleteLayer(layer_id));
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.get('/esri/server/layer', {
        name: 'Query Layer',
        group: 'ESRI',
        auth: 'user',
        description: 'Return Sample features and count',
        query: {
            type: 'object',
            required: ['layer', 'token', 'query'],
            properties: {
                layer: { type: 'string' },
                token: { type: 'string' },
                expires: { type: 'string' },
                query: { type: 'string' }
            }
        },
        res: {
            type: 'object'
        }
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(config.models, req, {
                anyResources: true
            });

            const base = new EsriBase(String(req.query.layer));
            if (req.query.token && req.query.expires) {
                base.token = {
                    token: String(req.query.token),
                    expires: Number(req.query.expires),
                    referer: config.API_URL
                }
            }

            const layer = new EsriProxyLayer(base);

            const count = await layer.query(String(req.query.query));

            return res.json(count)
        } catch (err) {
            return Err.respond(err, res);
        }
    });
}

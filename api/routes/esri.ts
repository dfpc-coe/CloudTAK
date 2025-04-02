import { Type } from '@sinclair/typebox'
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import Config from '../lib/config.js';
import { EsriType, EsriBase, EsriProxyPortal, EsriProxyServer, EsriProxyLayer } from '../lib/esri.js';

export default async function router(schema: Schema, config: Config) {
    await schema.post('/esri', {
        name: 'Validate & Auth',
        group: 'ESRI',
        description: `
            Helper API to configure ESRI MapServer Layers

            The URL can either be an ESRI Portal URL or a Server URL that doesn't require auth
            or supports token generation
        `,
        body: Type.Object({
            url: Type.String(),
            username: Type.Optional(Type.String()),
            password: Type.Optional(Type.String()),
            sinkid: Type.Optional(Type.Integer())
        }),
        res: Type.Object({
            type: Type.Enum(EsriType),
            base: Type.String(),
            auth: Type.Optional(Type.Object({
                token: Type.String(),
                referer: Type.String(),
                expires: Type.Integer()
            }))
        })
    }, async (req, res) => {
        try {
            await Auth.is_auth(config, req, {
                anyResources: true
            });

            let url
            try {
                url = new URL(req.body.url);
            } catch (err) {
                throw new Err(400, null, err instanceof Error ? err.message : String(err));
            }

            if (req.body.sinkid) {
                const sink = await config.models.ConnectionSink.from(req.body.sinkid);
                const body = sink.body as {
                    username: string;
                    password: string;
                };
                req.body.username = body.username;
                req.body.password = body.password;
            }

            let base;
            if (req.body.username && req.body.password) {
                base = await EsriBase.from(url, {
                    username: req.body.username,
                    password: req.body.password,
                    referer: config.API_URL,
                });
            } else {
                base = await EsriBase.from(url);
            }

            res.json({
                type: base.type,
                base: String(base.base),
                auth: base.token
            });
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.get('/esri/portal', {
        name: 'Portal Meta',
        group: 'ESRI',
        description: `
            Helper API to configure ESRI MapServers
            Return Portal Data
        `,
        query: Type.Object({
            portal: Type.String(),
            token: Type.Optional(Type.String()),
            expires: Type.Optional(Type.Integer())
        }),
        res: Type.Any()
    }, async (req, res) => {
        try {
            await Auth.is_auth(config, req, {
                anyResources: true
            });

            const base = new EsriBase(req.query.portal);
            if (req.query.token && req.query.expires) {
                base.token = {
                    token: req.query.token,
                    expires: req.query.expires,
                    referer: config.API_URL
                }
            }

            const portal = new EsriProxyPortal(base);
            res.json(await portal.getPortal());
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.get('/esri/portal/content', {
        name: 'Portal Content',
        group: 'ESRI',
        description: `
            Helper API to configure ESRI MapServers
            Return Portal Content
        `,
        query: Type.Object({
            portal: Type.String(),
            token: Type.Optional(Type.String()),
            expires: Type.Optional(Type.Integer()),
            title: Type.Optional(Type.String())
        }),
        res: Type.Any()
    }, async (req, res) => {
        try {
            await Auth.is_auth(config, req, {
                anyResources: true
            });

            const base = new EsriBase(req.query.portal);
            if (req.query.token && req.query.expires) {
                base.token = {
                    token: req.query.token,
                    expires: req.query.expires,
                    referer: config.API_URL
                }
            }

            const portal = new EsriProxyPortal(base);

            const content = await portal.getContent({
                title: req.query.title
            });

            res.json(content);
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.post('/esri/portal/service', {
        name: 'Create Service',
        group: 'ESRI',
        description: 'Create Service to store Feature Layers',
        query: Type.Object({
            portal: Type.String(),
            token: Type.String(),
            expires: Type.Integer()
        }),
        body: Type.Object({
            name: Type.String()
        }),
        res: Type.Any()
    }, async (req, res) => {
        try {
            await Auth.is_auth(config, req, {
                anyResources: true
            });

            const base = new EsriBase(req.query.portal);
            base.token = {
                token: req.query.token,
                expires: req.query.expires,
                referer: config.API_URL
            }

            const portal = new EsriProxyPortal(base);

            res.json(await portal.createService(req.body.name));
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.get('/esri/portal/server', {
        name: 'List Servers',
        group: 'ESRI',
        description: `
            Helper API to configure ESRI MapServers
            List Servers associates with a given portal
        `,
        query: Type.Object({
            portal: Type.String(),
            token: Type.String(),
            expires: Type.Integer()
        }),
        res: Type.Object({
            servers: Type.Array(Type.Any())
        })
    }, async (req, res) => {
        try {
            await Auth.is_auth(config, req, {
                anyResources: true
            });

            const base = new EsriBase(req.query.portal);
            base.token = {
                token: req.query.token,
                expires: req.query.expires,
                referer: config.API_URL
            }

            const portal = new EsriProxyPortal(base);
            const servers = await portal.getServers();

            res.json({
                servers: servers.servers
            });
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.get('/esri/server', {
        name: 'List Services',
        group: 'ESRI',
        description: 'Helper API to configure ESRI MapServers - Get Services',
        query: Type.Object({
            server: Type.String(),
            token: Type.Optional(Type.String()),
            expires: Type.Optional(Type.Integer())
        }),
        res: Type.Any()
    }, async (req, res) => {
        try {
            await Auth.is_auth(config, req, {
                anyResources: true
            });

            const base = new EsriBase(req.query.server);
            if (req.query.token && req.query.expires) {
                base.token = {
                    token: req.query.token,
                    expires: req.query.expires,
                    referer: config.API_URL
                }
            }

            const server = new EsriProxyServer(base);

            const list: any = await server.getList(base.postfix);
            if (!list.folders) list.folders = [];
            if (!list.services) list.services = [];

            res.json(list);
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.post('/esri/server/layer', {
        name: 'Create Layer',
        group: 'ESRI',
        description: 'Create Layer necessary to push CoT data',
        query: Type.Object({
            server: Type.String(),
            portal: Type.String(),
            token: Type.String(),
            expires: Type.Integer()
        }),
        res: Type.Any()
    }, async (req, res) => {
        try {
            await Auth.is_auth(config, req, {
                anyResources: true
            });

            const base = new EsriBase(req.query.server);
            base.token = {
                token: req.query.token,
                expires: req.query.expires,
                referer: config.API_URL
            }

            const server = new EsriProxyServer(base);

            res.json(await server.createLayer());
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.delete('/esri/server/layer', {
        name: 'Delete Layer',
        group: 'ESRI',
        description: 'Delete an ESRI Layer',
        query: Type.Object({
            server: Type.String(),
            portal: Type.String(),
            token: Type.String(),
            expires: Type.Integer()
        }),
        res: Type.Any()
    }, async (req, res) => {
        try {
            await Auth.is_auth(config, req, {
                anyResources: true
            });

            const url = new URL(req.query.server.replace(/\/\d+$/, ''));

            const parsed_layer = req.query.server.match(/\/\d+$/);
            if (!parsed_layer || !parsed_layer[0]) throw new Error('Could not parse layer ID');
            const layer_id = parseInt(parsed_layer[0].replace('/', ''));

            const base = new EsriBase(String(url));
            base.token = {
                token: req.query.token,
                expires: req.query.expires,
                referer: config.API_URL
            }

            const server = new EsriProxyServer(base);

            res.json(await server.deleteLayer(layer_id));
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.get('/esri/server/layer', {
        name: 'Query Layer',
        group: 'ESRI',
        description: 'Return Sample features and count',
        query: Type.Object({
            layer: Type.String(),
            query: Type.String(),
            token: Type.Optional(Type.String()),
            expires: Type.Optional(Type.Integer()),
        }),
        res: Type.Any()
    }, async (req, res) => {
        try {
            await Auth.is_auth(config, req, {
                anyResources: true
            });

            const base = new EsriBase(req.query.layer);

            if (req.query.token && req.query.expires) {
                base.token = {
                    token: req.query.token,
                    expires: req.query.expires,
                    referer: config.API_URL
                }
            }

            const layer = new EsriProxyLayer(base);

            const count = await layer.sample(req.query.query);

            res.json(count)
        } catch (err) {
            Err.respond(err, res);
        }
    });
}

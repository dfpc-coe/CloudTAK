import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import Config from '../lib/config.js';
import { Response } from 'express';
import { AuthRequest } from '@tak-ps/blueprint-login';
import {
    EsriProxyPortal,
    EsriProxyServer
} from '../lib/esri.js';

export default async function router(schema: any, config: Config) {
    await schema.post('/sink/esri', {
        name: 'Validate & Auth',
        group: 'SinkEsri',
        auth: 'user',
        description: `
            Helper API to configure ESRI MapServers

            An ESRI portal URL should be submitted along with the username & password.
            The portal will be verified and if it passes a TOKEN and portal type will be returned
        `,
        body: {
            type: "object",
            additionalProperties: false,
            required: [ "url", "username", "password" ],
            properties: {
                url: { "type": "string" },
                username: { "type": "string" },
                password: { "type": "string" }
            }
        },
        res: {
            type: "object",
            additionalProperties: false,
            properties: {
                type: {
                    type: 'string',
                    enum: [ 'AGOL', 'SERVER' ]
                },
                token: { type: "string" },
                referer: { type: "string" },
                expires: { type: "integer" },
                servers: {
                    type: "array",
                    items: { type: "object" }
                },
                content: {
                    type: "array",
                    items: { type: "object" }
                }
            }
        }
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(req);

            const esri = await EsriProxyPortal.init(
                new URL(req.body.url),
                config.API_URL,
                req.body.username,
                req.body.password
            );

            const servers = await esri.getServers();

            console.error(await esri.getContent());

            return res.json({
                type: esri.type,
                token: esri.token,
                referer: esri.referer,
                expires: esri.expires,
                servers: servers.servers,
                content: []
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.get('/sink/esri/portal', {
        name: 'List Servers',
        group: 'SinkEsri',
        auth: 'user',
        description: `
            Helper API to configure ESRI MapServers
            Return Portal Data
        `,
        query: {
            type: "object",
            additionalProperties: false,
            required: [ "portal", "token" ],
            properties: {
                portal: { "type": "string" },
                token: { "type": "string" },
            }
        },
        res: { type: "object" }
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(req);

            const esri = new EsriProxyPortal(
                String(req.query.token),
                +new Date() + 1000,
                new URL(String(req.query.portal)),
                config.API_URL,
            );

            const portal = await esri.getPortal();

            return res.json(portal);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.get('/sink/esri/portal/server', {
        name: 'List Servers',
        group: 'SinkEsri',
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
                portal: { "type": "string" },
                token: { "type": "string" },
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
            await Auth.is_auth(req);

            const esri = new EsriProxyPortal(
                String(req.query.token),
                +new Date() + 1000,
                new URL(String(req.query.portal)),
                config.API_URL,
            );

            const servers = await esri.getServers();

            return res.json({
                servers: servers.servers
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    /*
    await schema.get('/sink/esri', {
        name: 'Validate & Auth',
        group: 'SinkEsri',
        auth: 'user',
        description: 'Helper API to configure ESRI MapServers - Get Services',
        query: {
            type: 'object',
            required: ['url', 'token'],
            properties: {
                url: {
                    type: 'string'
                },
                token: {
                    type: 'string'
                }
            }
        },
        res: {
            type: 'object',
            required: ['folders', 'services'],
            properties: {
                folders: { type: "array" },
                services: { type: "array" },
            }
        }
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(req);

            const esri = new EsriProxy(
                String(req.query.token),
                +new Date() + 10000,
                new URL(String(req.query.url)),
                config.API_URL
            );

            const list = await esri.getList();
            if (!list.folders) list.folders = [];
            if (!list.services) list.services = [];

            return res.json(list);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.post('/sink/esri/service', {
        name: 'Create Service',
        group: 'SinkEsri',
        auth: 'user',
        description: 'Create Service to store Feature Layers',
        query: {
            type: 'object',
            required: ['url', 'token'],
            properties: {
                url: {
                    type: 'string'
                },
                token: {
                    type: 'string'
                }
            }
        },
        body: {
            type: 'object',
            required: ['name'],
            properties: {
                name: {
                    type: 'string'
                }
            }
        },
        res: 'res.Standard.json'
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(req);

            const esri = new EsriProxy(
                String(req.query.token),
                +new Date() + 10000,
                new URL(String(req.query.url)),
                config.API_URL
            );

            await esri.createService(req.body.name);

            return res.json({
                status: 200,
                message: 'Service Created'
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.post('/sink/esri/layer', {
        name: 'Create Layer',
        group: 'SinkEsri',
        auth: 'user',
        description: 'Create Layer necessary to push CoT data',
        query: {
            type: 'object',
            required: ['url', 'token'],
            properties: {
                url: {
                    type: 'string'
                },
                token: {
                    type: 'string'
                }
            }
        },
        res: 'res.Standard.json'
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(req);

            const esri = new EsriProxy(
                String(req.query.token),
                +new Date() + 10000,
                new URL(String(req.query.url)),
                config.API_URL
            );

            await esri.createLayer();

            return res.json({
                status: 200,
                message: 'Layer Created'
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.delete('/sink/esri/layer', {
        name: 'Delete Layer',
        group: 'SinkEsri',
        auth: 'user',
        description: 'Delete an ESRI Layer',
        query: {
            type: 'object',
            required: ['url', 'token'],
            properties: {
                url: {
                    type: 'string'
                },
                token: {
                    type: 'string'
                }
            }
        },
        res: 'res.Standard.json'
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(req);

            if (!String(req.query.url).match(/\/\d+$/)) throw new Err(400, null, 'Could not parse layer ID');

            const url = String(req.query.url).replace(/\/\d+$/, '');
            const layer_id = parseInt(String(req.query.url).match(/\/\d+$/)[0].replace('/', ''));

            const esri = new EsriProxy(
                String(req.query.token),
                +new Date() + 10000,
                new URL(String(url)),
                config.API_URL
            );

            await esri.deleteLayer(layer_id);

            return res.json({
                status: 200,
                message: 'Layer Deleted'
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });
    */
}

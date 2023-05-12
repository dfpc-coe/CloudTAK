import Err from '@openaddresses/batch-error';
// @ts-ignore
import BaseMap from '../lib/types/basemap.js';
import Auth from '../lib/auth.js';
import { sql } from 'slonik';
import Config from '../lib/config.js';
import { Request, Response } from 'express';
import xml2js from 'xml2js';

export default async function router(schema: any, config: Config) {
    await schema.get('/basemap', {
        name: 'List BaseMaps',
        group: 'BaseMap',
        auth: 'user',
        description: 'List BaseMaps',
        query: 'req.query.ListBaseMaps.json',
        res: 'res.ListBaseMaps.json'
    }, async (req: Request, res: Response) => {
        try {
            await Auth.is_auth(req);

            const list = await BaseMap.list(config.pool, req.query);

            return res.json(list);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.post('/basemap', {
        name: 'Create BaseMap',
        group: 'BaseMap',
        auth: 'admin',
        description: 'Register a new basemap',
        body: 'req.body.CreateBaseMap.json',
        res: 'basemaps.json'
    }, async (req: Request, res: Response) => {
        try {
            await Auth.is_auth(req);

            const basemap = await BaseMap.generate(config.pool, req.body);

            return res.json(basemap);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.patch('/basemap/:basemapid', {
        name: 'Update BaseMap',
        group: 'BaseMap',
        auth: 'admin',
        description: 'Update a basemap',
        ':basemapid': 'integer',
        body: 'req.body.PatchBaseMap.json',
        res: 'basemaps.json'
    }, async (req: Request, res: Response) => {
        try {
            await Auth.is_auth(req);
            const basemap = await BaseMap.commit(config.pool, req.params.basemapid, {
                updated: sql`Now()`,
                ...req.body
            });

            return res.json(basemap);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.get('/basemap/:basemapid', {
        name: 'Get BaseMap',
        group: 'BaseMap',
        auth: 'user',
        description: 'Get a basemap',
        ':basemapid': 'integer',
        query: 'req.query.BaseMap.json',
        res: 'basemaps.json'
    }, async (req: Request, res: Response) => {
        try {
            await Auth.is_auth(req);

            const basemap = await BaseMap.from(config.pool, req.params.basemapid);

            if (req.query.format === 'xml') {
                const builder = xml2js.Builder();

                const xml = builder.buildObject({
                    customMapSource: {
                        name: { _: '' },
                        minZoom: { _: '' },
                        maxZoom: { _: '' },
                        tileType: { _: '' },
                        tileUpdate: { _: 'None' },
                        url: { _: 'None' },
                        backgroundColor: { _: '#000000' },
                    }
                });

                return res.send(xml);
            } else {
                return res.json(basemap);
            }
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.delete('/basemap/:basemapid', {
        name: 'Delete BaseMap',
        group: 'BaseMap',
        auth: 'user',
        description: 'Delete a basemap',
        ':basemapid': 'integer',
        res: 'res.Standard.json'
    }, async (req: Request, res: Response) => {
        try {
            await Auth.is_auth(req);

            await BaseMap.delete(config.pool, req.params.basemapid);

            return res.json({
                status: 200,
                message: 'BaseMap Deleted'
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });
}

import { Type } from '@sinclair/typebox';
import { sql } from 'drizzle-orm';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth, { AuthResourceAccess } from '../../common/auth.js';
import type ConfigStateless from '../config.js';
import { LayerMap_Type } from '../../common/enums.js';
import LayerMapControl from '../lib/control/LayerMap.js';
import { StandardResponse, LayerMapResponse, LayerMapMappingField } from '../../common/types.js';
import type { LayerMapMapping } from '../../common/types.js';
import type { Static } from '@sinclair/typebox';
import * as Default from '../lib/limits.js';

export default async function router(schema: Schema, config: ConfigStateless) {
    async function layerFromConnection(req: {
        params: { connectionid: number; layerid: number };
    }): Promise<void> {
        const layer = await config.models.Layer.augmented_from(req.params.layerid);

        if (layer.connection !== req.params.connectionid) {
            throw new Err(400, null, 'Layer does not belong to this connection');
        }
    }

    await schema.get('/connection/:connectionid/layer/:layerid/map', {
        name: 'List Maps',
        group: 'LayerMap',
        description: 'List Maps of a given Layer',
        params: Type.Object({
            connectionid: Type.Integer({ minimum: 1 }),
            layerid: Type.Integer({ minimum: 1 }),
        }),
        query: Type.Object({
            limit: Default.Limit,
            page: Default.Page,
            order: Default.Order,
            sort: Type.String({ default: 'created', enum: ['id', 'created', 'updated', 'name', 'type', 'enabled'] }),
            filter: Default.Filter,
        }),
        res: Type.Object({
            total: Type.Integer(),
            items: Type.Array(LayerMapResponse),
        }),
    }, async (req, res) => {
        try {
            await Auth.is_connection(config, req, {
                resources: [
                    { access: AuthResourceAccess.CONNECTION, id: req.params.connectionid },
                    { access: AuthResourceAccess.LAYER, id: req.params.layerid },
                ],
            }, req.params.connectionid);

            await layerFromConnection(req);

            const list = await config.models.LayerMap.list({
                limit: req.query.limit,
                page: req.query.page,
                order: req.query.order,
                sort: req.query.sort,
                where: sql`name ~* ${req.query.filter} AND layer = ${req.params.layerid}`,
            });

            res.json(list);
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.post('/connection/:connectionid/layer/:layerid/map', {
        name: 'Create Map',
        group: 'LayerMap',
        description: 'Create a new Map on a Layer - Maps convert arbitrary JSON submitted to /layer/:layerid/submit into CoreFeatures, CoreEvents or CoreDevices',
        params: Type.Object({
            connectionid: Type.Integer({ minimum: 1 }),
            layerid: Type.Integer({ minimum: 1 }),
        }),
        body: Type.Object({
            name: Default.NameField,
            enabled: Type.Boolean({ default: true }),
            query: Type.String({
                minLength: 1,
                description: 'JSONata query run against the submitted JSON payload - must output one or more records of the Map type',
            }),
            type: Type.Enum(LayerMap_Type),
            mapping: Type.Optional(LayerMapMappingField),
        }),
        res: LayerMapResponse,
    }, async (req, res) => {
        try {
            const { connection } = await Auth.is_connection(config, req, {
                resources: [
                    { access: AuthResourceAccess.CONNECTION, id: req.params.connectionid },
                    { access: AuthResourceAccess.LAYER, id: req.params.layerid },
                ],
            }, req.params.connectionid);

            if (connection.readonly) throw new Err(400, null, 'Connection is Read-Only mode');

            await layerFromConnection(req);

            const mapping = (req.body.mapping || {}) as Static<typeof LayerMapMapping>;

            LayerMapControl.validate(req.body.type, req.body.query, mapping);

            const map = await config.models.LayerMap.generate({
                ...req.body,
                mapping,
                layer: req.params.layerid,
            });

            res.json(map);
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.get('/connection/:connectionid/layer/:layerid/map/:mapid', {
        name: 'Get Map',
        group: 'LayerMap',
        description: 'Get a Map of a given Layer',
        params: Type.Object({
            connectionid: Type.Integer({ minimum: 1 }),
            layerid: Type.Integer({ minimum: 1 }),
            mapid: Type.String({ format: 'uuid' }),
        }),
        res: LayerMapResponse,
    }, async (req, res) => {
        try {
            await Auth.is_connection(config, req, {
                resources: [
                    { access: AuthResourceAccess.CONNECTION, id: req.params.connectionid },
                    { access: AuthResourceAccess.LAYER, id: req.params.layerid },
                ],
            }, req.params.connectionid);

            await layerFromConnection(req);

            const map = await config.models.LayerMap.from(req.params.mapid);

            if (map.layer !== req.params.layerid) {
                throw new Err(400, null, 'Map does not belong to this layer');
            }

            res.json(map);
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.patch('/connection/:connectionid/layer/:layerid/map/:mapid', {
        name: 'Update Map',
        group: 'LayerMap',
        description: 'Update a Map of a given Layer',
        params: Type.Object({
            connectionid: Type.Integer({ minimum: 1 }),
            layerid: Type.Integer({ minimum: 1 }),
            mapid: Type.String({ format: 'uuid' }),
        }),
        body: Type.Object({
            name: Type.Optional(Default.NameField),
            enabled: Type.Optional(Type.Boolean()),
            query: Type.Optional(Type.String({ minLength: 1 })),
            type: Type.Optional(Type.Enum(LayerMap_Type)),
            mapping: Type.Optional(LayerMapMappingField),
        }),
        res: LayerMapResponse,
    }, async (req, res) => {
        try {
            const { connection } = await Auth.is_connection(config, req, {
                resources: [
                    { access: AuthResourceAccess.CONNECTION, id: req.params.connectionid },
                    { access: AuthResourceAccess.LAYER, id: req.params.layerid },
                ],
            }, req.params.connectionid);

            if (connection.readonly) throw new Err(400, null, 'Connection is Read-Only mode');

            await layerFromConnection(req);

            let map = await config.models.LayerMap.from(req.params.mapid);

            if (map.layer !== req.params.layerid) {
                throw new Err(400, null, 'Map does not belong to this layer');
            }

            LayerMapControl.validate(
                req.body.type !== undefined ? req.body.type : map.type,
                req.body.query !== undefined ? req.body.query : map.query,
                (req.body.mapping !== undefined ? req.body.mapping : map.mapping) as Static<typeof LayerMapMapping>,
            );

            map = await config.models.LayerMap.commit(req.params.mapid, {
                ...req.body,
                mapping: req.body.mapping as Static<typeof LayerMapMapping> | undefined,
                updated: sql`Now()`,
            });

            res.json(map);
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.delete('/connection/:connectionid/layer/:layerid/map/:mapid', {
        name: 'Delete Map',
        group: 'LayerMap',
        description: 'Delete a Map of a given Layer',
        params: Type.Object({
            connectionid: Type.Integer({ minimum: 1 }),
            layerid: Type.Integer({ minimum: 1 }),
            mapid: Type.String({ format: 'uuid' }),
        }),
        res: StandardResponse,
    }, async (req, res) => {
        try {
            const { connection } = await Auth.is_connection(config, req, {
                resources: [
                    { access: AuthResourceAccess.CONNECTION, id: req.params.connectionid },
                    { access: AuthResourceAccess.LAYER, id: req.params.layerid },
                ],
            }, req.params.connectionid);

            if (connection.readonly) throw new Err(400, null, 'Connection is Read-Only mode');

            await layerFromConnection(req);

            const map = await config.models.LayerMap.from(req.params.mapid);

            if (map.layer !== req.params.layerid) {
                throw new Err(400, null, 'Map does not belong to this layer');
            }

            await config.models.LayerMap.delete(req.params.mapid);

            res.json({
                status: 200,
                message: 'Map Deleted',
            });
        } catch (err) {
            Err.respond(err, res);
        }
    });
}

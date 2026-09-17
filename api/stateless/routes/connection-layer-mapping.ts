import { Type } from '@sinclair/typebox';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import jsonata from 'jsonata';
import { sql, eq, and } from 'drizzle-orm';
import { GenericListOrder } from '@openaddresses/batch-generic';
import Auth, { AuthResourceAccess } from '../../common/auth.js';
import type ConfigStateless from '../config.js';
import { LayerMapping } from '../../common/schema.js';
import { LayerMapping_Destination } from '../../common/enums.js';
import { StandardResponse, LayerMappingResponse } from '../../common/types.js';
import Mapping from '../../common/mapping.js';
import * as Default from '../lib/limits.js';

const MappingQuery = Type.Union([Type.Null(), Type.String({ minLength: 1 })], {
    description: 'JSONata query evaluated against each record - null matches every record',
});

const MappingObject = Type.Record(Type.String(), Type.Unknown(), {
    description: 'Mapping object applied to records matched by the query - a field is either its bare value or `{ value, update }` where `update: false` only applies the field when a CoreEvent or CoreDevice is first created',
});

function validateQuery(query: string | null | undefined): void {
    if (!query) return;

    try {
        jsonata(query);
    } catch (err) {
        throw new Err(400, null, `Invalid JSONata query: ${err instanceof Error ? err.message : String(err)}`);
    }
}

const LayerParams = Type.Object({
    connectionid: Type.Integer({ minimum: 1 }),
    layerid: Type.Integer({ minimum: 1 }),
});

const MappingParams = Type.Composite([LayerParams, Type.Object({
    mappingid: Type.Integer({ minimum: 1 }),
})]);

export default async function router(schema: Schema, config: ConfigStateless) {
    async function layerAccess(req: Parameters<typeof Auth.is_connection>[1], connectionid: number, layerid: number) {
        const { connection } = await Auth.is_connection(config, req, {
            resources: [
                { access: AuthResourceAccess.CONNECTION, id: connectionid },
                { access: AuthResourceAccess.LAYER, id: layerid },
            ],
        }, connectionid);

        if (connection.readonly) throw new Err(400, null, 'Connection is Read-Only mode');

        const layer = await config.models.Layer.augmented_from(layerid);

        if (layer.connection !== connection.id) {
            throw new Err(400, null, 'Layer does not belong to this connection');
        } else if (!layer.incoming) {
            throw new Err(400, null, 'Layer does not have incoming config');
        }

        return layer;
    }

    async function mappingFrom(layerid: number, mappingid: number) {
        const mapping = await config.models.LayerMapping.from(mappingid);

        if (mapping.layer !== layerid) {
            throw new Err(404, null, 'Mapping does not belong to this layer');
        }

        return mapping;
    }

    await schema.get('/connection/:connectionid/layer/:layerid/incoming/mapping', {
        name: 'List Mappings',
        group: 'LayerMapping',
        description: 'List the Mappings of an incoming layer configuration',
        params: LayerParams,
        query: Type.Object({
            schema: Type.Optional(Type.String({ description: 'Only return Mappings for this named Output schema' })),
            destination: Type.Optional(Type.Enum(LayerMapping_Destination)),
        }),
        res: Type.Object({
            total: Type.Integer(),
            items: Type.Array(LayerMappingResponse),
        }),
    }, async (req, res) => {
        try {
            await layerAccess(req, req.params.connectionid, req.params.layerid);

            const list = await config.models.LayerMapping.list({
                limit: Number.MAX_SAFE_INTEGER,
                order: GenericListOrder.ASC,
                sort: 'id',
                where: and(
                    eq(LayerMapping.layer, req.params.layerid),
                    req.query.schema ? eq(LayerMapping.schema, req.query.schema) : undefined,
                    req.query.destination ? eq(LayerMapping.destination, req.query.destination) : undefined,
                ),
            });

            res.json(list);
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.post('/connection/:connectionid/layer/:layerid/incoming/mapping', {
        name: 'Create Mapping',
        group: 'LayerMapping',
        description: 'Create a Mapping on an incoming layer configuration',
        params: LayerParams,
        body: Type.Object({
            schema: Type.String({ minLength: 1, description: 'Named Output schema of the Task the Mapping applies to' }),
            name: Default.NameField,
            destination: Type.Enum(LayerMapping_Destination, { default: LayerMapping_Destination.COREFEATURE }),
            query: Type.Optional(MappingQuery),
            mapping: Type.Optional(MappingObject),
        }),
        res: LayerMappingResponse,
    }, async (req, res) => {
        try {
            await layerAccess(req, req.params.connectionid, req.params.layerid);

            validateQuery(req.body.query);
            Mapping.validate(req.body.destination, req.body.mapping ?? {});

            const mapping = await config.models.LayerMapping.generate({
                layer: req.params.layerid,
                schema: req.body.schema,
                name: req.body.name,
                destination: req.body.destination,
                query: req.body.query ?? null,
                mapping: req.body.mapping ?? {},
            });

            res.json(mapping);
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.get('/connection/:connectionid/layer/:layerid/incoming/mapping/:mappingid', {
        name: 'Get Mapping',
        group: 'LayerMapping',
        description: 'Get a Mapping of an incoming layer configuration',
        params: MappingParams,
        res: LayerMappingResponse,
    }, async (req, res) => {
        try {
            await layerAccess(req, req.params.connectionid, req.params.layerid);

            res.json(await mappingFrom(req.params.layerid, req.params.mappingid));
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.patch('/connection/:connectionid/layer/:layerid/incoming/mapping/:mappingid', {
        name: 'Update Mapping',
        group: 'LayerMapping',
        description: 'Update a Mapping of an incoming layer configuration',
        params: MappingParams,
        body: Type.Object({
            schema: Type.Optional(Type.String({ minLength: 1 })),
            name: Type.Optional(Default.NameField),
            destination: Type.Optional(Type.Enum(LayerMapping_Destination)),
            query: Type.Optional(MappingQuery),
            mapping: Type.Optional(MappingObject),
        }),
        res: LayerMappingResponse,
    }, async (req, res) => {
        try {
            await layerAccess(req, req.params.connectionid, req.params.layerid);
            const existing = await mappingFrom(req.params.layerid, req.params.mappingid);

            validateQuery(req.body.query);
            Mapping.validate(req.body.destination ?? existing.destination, req.body.mapping ?? existing.mapping);

            const mapping = await config.models.LayerMapping.commit(req.params.mappingid, {
                updated: sql`Now()`,
                ...req.body,
            });

            res.json(mapping);
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.delete('/connection/:connectionid/layer/:layerid/incoming/mapping/:mappingid', {
        name: 'Delete Mapping',
        group: 'LayerMapping',
        description: 'Delete a Mapping of an incoming layer configuration',
        params: MappingParams,
        res: StandardResponse,
    }, async (req, res) => {
        try {
            await layerAccess(req, req.params.connectionid, req.params.layerid);
            await mappingFrom(req.params.layerid, req.params.mappingid);

            await config.models.LayerMapping.delete(req.params.mappingid);

            res.json({
                status: 200,
                message: 'Mapping Deleted',
            });
        } catch (err) {
            Err.respond(err, res);
        }
    });
}

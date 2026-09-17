import { Type } from '@sinclair/typebox';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth from '../../common/auth.js';
import { CoreSchemas } from '../../common/core-schema.js';
import { CoreSchemaSummary, CoreSchemaResponse } from '../../common/types.js';
import { LayerMapping_Destination } from '../../common/enums.js';
import type ConfigStateless from '../config.js';

export default async function router(schema: Schema, config: ConfigStateless) {
    await schema.get('/core/schema', {
        name: 'List Schemas',
        group: 'CoreSchema',
        description: 'List the record types supported by the Server',
        res: Type.Object({
            total: Type.Integer(),
            items: Type.Array(CoreSchemaSummary),
        }),
    }, async (req, res) => {
        try {
            await Auth.is_auth(config, req);

            const items = Object.values(LayerMapping_Destination).map(id => ({
                id,
                title: String(CoreSchemas[id].title),
                description: String(CoreSchemas[id].description),
            }));

            res.json({ total: items.length, items });
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.get('/core/schema/:id', {
        name: 'Get Schema',
        group: 'CoreSchema',
        description: 'Get the JSON Schema of a record type supported by the Server',
        params: Type.Object({
            id: Type.String(),
        }),
        res: CoreSchemaResponse,
    }, async (req, res) => {
        try {
            await Auth.is_auth(config, req);

            const id = Object.values(LayerMapping_Destination).find(d => d === req.params.id);
            if (!id) throw new Err(404, null, 'Schema not found');

            const { title, description, properties, required } = CoreSchemas[id];

            res.json({
                $id: id,
                title: String(title),
                description: String(description),
                type: 'object',
                required: required ?? [],
                properties,
            });
        } catch (err) {
            Err.respond(err, res);
        }
    });
}

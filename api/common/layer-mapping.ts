import { Type } from '@sinclair/typebox';
import { sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import { LayerMapping_Destination } from './enums.js';

export const LayerMapQuery = Type.Object({
    id: Type.Integer({ description: 'Unique ID of the query' }),
    name: Type.String({ description: 'Human readable name of the query' }),
    query: Type.Union([Type.Null(), Type.String()], {
        description: 'JSONata query evaluated against each record - null matches every record',
    }),
    map: Type.Record(Type.String(), Type.Unknown(), {
        description: 'Mapping object applied to records matched by the query',
    }),
});

export const LayerMap = Type.Object({
    schema: Type.String({ description: 'Named Output schema of the Task the Map applies to' }),
    destination: Type.Enum(LayerMapping_Destination),
    queries: Type.Array(LayerMapQuery),
});

/**
 * Correlated subquery aggregating the layer_mapping rows of a Layer into the
 * `maps` array of the Layer Incoming response - one entry per schema &
 * destination pair with its queries in insertion order
 */
export function layerMapsSQL(layer: PgColumn | SQL): SQL {
    return sql`COALESCE((
        SELECT json_agg(json_build_object(
            'schema', m.schema,
            'destination', m.destination,
            'queries', m.queries
        ) ORDER BY m.schema, m.destination)
        FROM (
            SELECT lm.schema, lm.destination, json_agg(json_build_object(
                'id', lm.id,
                'name', lm.name,
                'query', lm.query,
                'map', lm.mapping
            ) ORDER BY lm.id) AS queries
            FROM layer_mapping lm
            WHERE lm.layer = ${layer}
            GROUP BY lm.schema, lm.destination
        ) m
    ), '[]'::json)`;
}

import { Type } from '@sinclair/typebox';

/** Mirrors the CloudTAK API TileJSON response schema */
export const TileJSON_VectorLayer = Type.Object({
    id: Type.String(),
    fields: Type.Record(Type.String(), Type.String()),
    minzoom: Type.Optional(Type.Integer()),
    maxzoom: Type.Optional(Type.Integer()),
    description: Type.Optional(Type.String()),
});

export const TileJSON_Legend = Type.Array(Type.Object({
    label: Type.String(),
    color: Type.String({ description: 'CSS color of the legend swatch' }),
}), { description: 'Raster legend entries - a CloudTAK extension to TileJSON' });

export const TileJSON = Type.Object({
    tilejson: Type.Literal('3.0.0'),
    version: Type.String(),
    scheme: Type.Literal('xyz'),
    name: Type.String(),
    description: Type.String(),
    attribution: Type.Optional(Type.String()),
    tileSize: Type.Optional(Type.Integer()),
    minzoom: Type.Integer(),
    maxzoom: Type.Integer(),
    tiles: Type.Array(Type.String()),
    bounds: Type.Tuple([Type.Number(), Type.Number(), Type.Number(), Type.Number()]),
    encoding: Type.Optional(Type.String({ enum: ['mapbox', 'terrarium'] })),
    center: Type.Array(Type.Number()),
    type: Type.String(),
    format: Type.Optional(Type.String()),
    vector_layers: Type.Optional(Type.Array(TileJSON_VectorLayer)),
    legend: Type.Optional(TileJSON_Legend),
});

export const TileJSONActions = Type.Object({
    feature: Type.Array(Type.String({ enum: ['query', 'fetch', 'create', 'update', 'delete'] })),
});

export const AugmentedTileJSON = Type.Composite([
    TileJSON,
    Type.Object({
        actions: TileJSONActions,
    }),
]);

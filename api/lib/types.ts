import { createSelectSchema } from 'drizzle-typebox';
import { Type } from '@sinclair/typebox'
import * as schemas from './schema.js';

export const StandardResponse = Type.Object({
    status: Type.Integer(),
    message: Type.String()
});

export const ImportResponse = createSelectSchema(schemas.Import, {
});

export const IconsetResponse = createSelectSchema(schemas.Iconset, {
    version: Type.Integer(),
    skip_resize: Type.Boolean(),
});

export const IconResponse = createSelectSchema(schemas.Icon, {
    id: Type.Integer(),
});

export const DataResponse = Type.Object({
    id: Type.Integer(),
    created: Type.String(),
    updated: Type.String(),
    name: Type.String(),
    mission_sync: Type.Boolean(),
    mission_exists: Type.Boolean({"description": "Does the mission exist in TAK Server"}),
    mission_error: Type.Optional(Type.String({ description: "Returned only if there is an error syncing the mission with the TAK Server"})),
    mission_groups: Type.Array(Type.String()),
    mission_role: Type.String(),
    assets: Type.Array(Type.String()),
    description: Type.String(),
    connection: Type.Integer(),
    auto_transform: Type.Boolean()
});

export const DataListResponse = createSelectSchema(schemas.Data, {
    id: Type.Integer(),
    connection: Type.Integer(),
    assets: Type.Array(Type.String()),
    mission_groups: Type.Array(Type.String()),
    auto_transform: Type.Boolean(),
    mission_sync: Type.Boolean(),
});

export const DataJobLogResponse = Type.Object({
    message: Type.String(),
    timestamp: Type.Integer(),
})

export const DataJobResponse = Type.Object({
    id: Type.String(),
    asset: Type.String(),
    status: Type.String(),
    created: Type.Integer(),
    updated: Type.Integer()
});

export const AssetResponse = Type.Object({
    name: Type.String({ "description": "The filename of the asset" }),
    sync: Type.Boolean({ "description": "If the Data is attached to a mission, signify if the asset is syncing with the mission" }),
    visualized: Type.Union([Type.String(), Type.Boolean()]),
    vectorized: Type.Union([Type.String(), Type.Boolean()]),
    updated: Type.String(),
    etag: Type.String({ "description": "AWS S3 generated ETag of the asset" }),
    size: Type.String({ "description": "Size in bytes of the asset" })
})

export const GenericMartiResponse = Type.Object({
    version: Type.String(),
    type: Type.String(),
    data:  Type.Any(),
    messages: Type.Optional(Type.Array(Type.String())),
    nodeId: Type.Optional(Type.String())
});

/** Includes Token itself */
export const CreateConnectionTokenResponse = createSelectSchema(schemas.ConnectionToken, {
    id: Type.Integer(),
    connection: Type.Integer()
});

export const ConnectionTokenResponse = Type.Object({
    id: Type.Integer(),
    connection: Type.Integer(),
    name: Type.String(),
    created: Type.String(),
    updated: Type.String(),
});

export const ConnectionSinkResponse = createSelectSchema(schemas.ConnectionSink, {
    id: Type.Integer(),
    connection: Type.Integer(),
    enabled: Type.Boolean(),
    logging: Type.Boolean(),
    body: Type.Unknown()
});

export const ConnectionResponse = Type.Object({
    id: Type.Integer(),
    status: Type.String(),
    certificate: Type.Object({
        validFrom: Type.String(),
        validTo: Type.String()
    }),
    created: Type.String(),
    updated: Type.String(),
    name: Type.String(),
    description: Type.String(),
    enabled: Type.Boolean(),
});

export const BasemapResponse = createSelectSchema(schemas.Basemap, {
    id: Type.Integer(),
    minzoom: Type.Integer(),
    maxzoom: Type.Integer()
});

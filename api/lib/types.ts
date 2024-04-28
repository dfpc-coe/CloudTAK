import { createSelectSchema } from 'drizzle-typebox';
import { Type } from '@sinclair/typebox'
import { StyleContainer } from './style.js';
import * as schemas from './schema.js';
import { TAKGroup, TAKRole } from './api/types.js';
import { Layer_Priority } from './enums.js';
import { AugmentedData } from './models/Data.js';

export const DataResponse = AugmentedData;

export const StandardResponse = Type.Object({
    status: Type.Integer(),
    message: Type.String()
});

export const ServerResponse = Type.Object({
    id: Type.Integer(),
    status: Type.String(),
    created: Type.String(),
    updated: Type.String(),
    provider_client: Type.String(),
    provider_secret: Type.String(),
    provider_url: Type.String(),
    name: Type.String(),
    url: Type.String(),
    api: Type.String(),
    auth: Type.Boolean({ "description": "Once an admin certificate is configured it is not retrivable. This boolean refers to if a certificate is currently loaded" })
})

export const ProfileResponse = Type.Object({
    username: Type.String(),
    created: Type.String(),
    updated: Type.String(),
    phone: Type.String(),
    last_login: Type.String(),
    system_admin: Type.Boolean(),
    agency_admin: Type.Array(Type.Integer()),
    tak_callsign: Type.String(),
    tak_group: Type.Enum(TAKGroup),
    tak_role: Type.Enum(TAKRole),
    tak_loc: Type.Any(),
    display_stale: Type.String(),
    display_distance: Type.String(),
    display_elevation: Type.String(),
    display_speed: Type.String()
});

export const OverlayResponse = createSelectSchema(schemas.Overlay, {
    id: Type.Integer(),
});

export const ProfileOverlayResponse = createSelectSchema(schemas.ProfileOverlay, {
    id: Type.Integer(),
    pos: Type.Integer(),
    opacity: Type.Number(),
    visible: Type.Boolean(),
});

export const Layer_Config = Type.Object({
    timezone: Type.Optional(Type.Object({
        timezone: Type.String()
    }))
});

export const LayerResponse = Type.Object({
    id: Type.Integer(),
    status: Type.String(),
    priority: Type.Enum(Layer_Priority),
    created: Type.String(),
    updated: Type.String(),
    name: Type.String(),
    description: Type.String(),
    enabled: Type.Boolean(),
    enabled_styles: Type.Boolean(),
    styles: StyleContainer,
    logging: Type.Boolean(),
    stale: Type.Integer(),
    task: Type.String(),
    connection: Type.Optional(Type.Integer()),
    cron: Type.String(),
    environment: Type.Any(),
    config: Layer_Config,
    memory: Type.Integer(),
    timeout: Type.Integer(),
    data: Type.Optional(Type.Integer()),
    schema: Type.Any()
});

export const LayerAlertResponse = createSelectSchema(schemas.LayerAlert, {
    id: Type.Integer(),
    hidden: Type.Boolean(),
    layer: Type.Integer(),
});

export const ImportResponse = createSelectSchema(schemas.Import, {});

export const IconsetResponse = createSelectSchema(schemas.Iconset, {
    version: Type.Integer(),
    skip_resize: Type.Boolean(),
});

export const IconResponse = createSelectSchema(schemas.Icon, {
    id: Type.Integer(),
});

export const DataListResponse = createSelectSchema(schemas.Data, {
    id: Type.Integer(),
    connection: Type.Integer(),
    assets: Type.Array(Type.String()),
    mission_groups: Type.Array(Type.String()),
    auto_transform: Type.Boolean(),
    mission_sync: Type.Boolean({description: "Is the mission syncing with TAK Server"}),
    mission_diff: Type.Boolean({description: "Allow a single layer to diff sync with TAK"}),
});

export const JobLogResponse = Type.Object({
    message: Type.String(),
    timestamp: Type.Integer(),
})

export const JobResponse = Type.Object({
    id: Type.String(),
    asset: Type.String(),
    status: Type.String(),
    created: Type.Integer(),
    updated: Type.Optional(Type.Integer())
});

export const ProfileAssetResponse = Type.Object({
    name: Type.String({ "description": "The filename of the asset" }),
    visualized: Type.Optional(Type.String()),
    vectorized: Type.Optional(Type.String()),
    updated: Type.Integer(),
    etag: Type.String({ "description": "AWS S3 generated ETag of the asset" }),
    size: Type.Integer({ "description": "Size in bytes of the asset" })
})

export const AssetResponse = Type.Object({
    name: Type.String({ "description": "The filename of the asset" }),
    visualized: Type.Optional(Type.String()),
    vectorized: Type.Optional(Type.String()),
    updated: Type.Integer(),
    sync: Type.Boolean({ description: "Does this file meet the glob rules to sync with the server" }),
    etag: Type.String({ "description": "AWS S3 generated ETag of the asset" }),
    size: Type.Integer({ "description": "Size in bytes of the asset" })
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

/** Includes Token itself */
export const CreateProfileTokenResponse = createSelectSchema(schemas.Token, {
    id: Type.Integer(),
});

export const ProfileTokenResponse = Type.Object({
    id: Type.Integer(),
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
    agency: Type.Optional(Type.Union([Type.Integer(), Type.Null()])),
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

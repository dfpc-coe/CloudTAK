import { createSelectSchema } from 'drizzle-typebox';
import { Type } from '@sinclair/typebox'
import * as schemas from './schema.js';
import { TAKGroup, TAKRole } from '@tak-ps/node-tak/lib/api/types';
import { Profile_Projection, Profile_Zoom, Profile_Stale, Profile_Distance, Profile_Elevation, Profile_Speed, Profile_Text } from './enums.js';
import { AugmentedData } from './models/Data.js';
import { AugmentedLayer, AugmentedLayerIncoming, AugmentedLayerOutgoing } from './models/Layer.js';
import { Basemap_Format, Basemap_Scheme, Basemap_Type } from '../lib/enums.js';
import { Feature } from '@tak-ps/node-cot';

export const LayerResponse = AugmentedLayer;
export const LayerIncomingResponse = AugmentedLayerIncoming;
export const LayerOutgoingResponse = AugmentedLayerOutgoing;
export const DataResponse = AugmentedData;

export const GeoJSONFeature = Type.Object({
    id: Type.Optional(Type.String()),
    type: Type.Literal('Feature'),
    properties: Type.Record(Type.String(), Type.Unknown()),
    geometry: Feature.Geometry
})

export const GeoJSONFeatureCollection = Type.Object({
    type: Type.Literal('FeatureCollection'),
    features: Type.Array(GeoJSONFeature)
});

export const OptionalTileJSON = Type.Object({
    name: Type.Optional(Type.String()),
    type: Type.Optional(Type.Enum(Basemap_Type)),
    url: Type.Optional(Type.String()),
    bounds: Type.Optional(Type.Any()),
    center: Type.Optional(Type.Any()),
    minzoom: Type.Optional(Type.Integer()),
    maxzoom: Type.Optional(Type.Integer()),
    style: Type.Optional(Type.Enum(Basemap_Scheme)),
    format: Type.Optional(Type.Enum(Basemap_Format))
});

export const LayerError = Type.Object({
    error: Type.String(),
    feature: Feature.InputFeature
});

export const StandardLayerResponse = Type.Object({
    status: Type.Integer(),
    message: Type.String(),
    errors: Type.Array(LayerError)
});

export const StandardResponse = Type.Object({
    status: Type.Integer(),
    message: Type.String()
});

export const PaletteFeatureResponse = createSelectSchema(schemas.PaletteFeature, {
    uuid: Type.String(),
});


const Palette = createSelectSchema(schemas.Palette, {
    uuid: Type.String(),
    created: Type.String(),
    updated: Type.String(),
})

export const PaletteResponse = Type.Composite([
    Palette,
    Type.Object({
        features: Type.Array(PaletteFeatureResponse)
    })
]);

export const PaletteFeatureStyle = Type.Object({
    'marker-color': Type.Optional(Type.String()),
    'marker-opacity': Type.Optional(Type.String()),

    icon: Type.Optional(Type.String()),

    stroke: Type.Optional(Type.String()),
    'stroke-style': Type.Optional(Type.String()),
    'stroke-opacity': Type.Optional(Type.String()),
    'stroke-width': Type.Optional(Type.String()),
    fill: Type.Optional(Type.String()),
    'fill-opacity': Type.Optional(Type.String()),
})

export const IconsetResponse = Type.Object({
    uid: Type.String(),
    created: Type.String(),
    updated: Type.String(),
    version: Type.Integer(),
    name: Type.String(),
    username: Type.Union([Type.Null(), Type.String()]),
    default_group: Type.Union([Type.Null(), Type.String()]),
    default_friendly: Type.Union([Type.Null(), Type.String()]),
    default_hostile: Type.Union([Type.Null(), Type.String()]),
    default_neutral: Type.Union([Type.Null(), Type.String()]),
    default_unknown: Type.Union([Type.Null(), Type.String()]),
    skip_resize: Type.Boolean()
});

export const ServerResponse = Type.Object({
    id: Type.Integer(),
    status: Type.String(),
    created: Type.String(),
    updated: Type.String(),
    version: Type.String(),
    name: Type.String(),
    url: Type.String(),
    api: Type.String(),
    webtak: Type.String(),
    auth: Type.Boolean({ "description": "Once an admin certificate is configured it is not retrivable. This boolean refers to if a certificate is currently loaded" }),
    certificate: Type.Optional(Type.Object({
        subject: Type.String(),
        validFrom: Type.String(),
        validTo: Type.String()
    })),
})

export const ProfileResponse = Type.Object({
    username: Type.String(),
    created: Type.String(),
    updated: Type.String(),
    phone: Type.String(),
    last_login: Type.String(),
    active: Type.Boolean({
        description: 'Does the user have an active CloudTAK Session'
    }),
    system_admin: Type.Boolean(),
    agency_admin: Type.Array(Type.Integer()),
    tak_callsign: Type.String(),
    tak_remarks: Type.String(),
    tak_group: Type.Enum(TAKGroup),
    tak_role: Type.Enum(TAKRole),
    tak_type: Type.String(),
    tak_loc: Type.Union([Type.Object({
        type: Type.Literal('Point'),
        coordinates: Type.Array(Type.Number())
    }), Type.Null()]),
    tak_loc_freq: Type.Integer(),
    display_projection: Type.Enum(Profile_Projection),
    display_zoom: Type.Enum(Profile_Zoom),
    display_icon_rotation: Type.Boolean(),
    display_stale: Type.Enum(Profile_Stale),
    display_text: Type.Enum(Profile_Text),
    display_distance: Type.Enum(Profile_Distance),
    display_elevation: Type.Enum(Profile_Elevation),
    display_speed: Type.Enum(Profile_Speed)
});

export const VideoLeaseResponse = createSelectSchema(schemas.VideoLease, {
    id: Type.Integer(),
    ephemeral: Type.Boolean(),
    expiration: Type.Union([Type.Null(), Type.String()]),
    channel: Type.Union([Type.Null(), Type.String()]),
    proxy: Type.Union([Type.Null(), Type.String()]),
});

export const ProfileOverlayResponse = createSelectSchema(schemas.ProfileOverlay, {
    id: Type.Integer(),
    pos: Type.Integer(),
    opacity: Type.Number(),
    visible: Type.Boolean(),
    styles: Type.Array(Type.Unknown())
});

export const ProfileInterestResponse = createSelectSchema(schemas.ProfileInterest, {
    id: Type.Integer(),
    bounds: Feature.Geometry
});

export const ProfileVideoResponse = createSelectSchema(schemas.ProfileVideo, {
    lease: Type.Integer()
});

export const FeatureResponse = Type.Composite([ Feature.Feature, Type.Object({
    path: Type.String({ default: '/' }),
})]);

export const LayerAlertResponse = createSelectSchema(schemas.LayerAlert, {
    id: Type.Integer(),
    hidden: Type.Boolean(),
    layer: Type.Integer(),
});

export const ImportResponse = createSelectSchema(schemas.Import, {
    config: Type.Unknown(),
    result: Type.Unknown()
});

export const ErrorResponse = createSelectSchema(schemas.Errors, {
    id: Type.Integer(),
    created: Type.String(),
    updated: Type.String(),
});

export const TaskResponse = createSelectSchema(schemas.Task, {
    id: Type.Integer(),
    created: Type.String(),
    updated: Type.String(),
});

export const IconResponse = createSelectSchema(schemas.Icon, {
    id: Type.Integer(),
});

export const DataListResponse = createSelectSchema(schemas.Data, {
    id: Type.Integer(),
    connection: Type.Integer(),
    assets: Type.Array(Type.String()),
    mission_groups: Type.Array(Type.String()),
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

export const ProfileFileResponse = createSelectSchema(schemas.ProfileFile, {
    id: Type.String(),
    artifacts: Type.Array(Type.Object({
        ext: Type.String(),
        size: Type.Integer(),
    }))
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
export const CreateProfileTokenResponse = createSelectSchema(schemas.ProfileToken, {
    id: Type.Integer(),
});

export const ProfileTokenResponse = Type.Object({
    id: Type.Integer(),
    name: Type.String(),
    username: Type.String(),
    created: Type.String(),
    updated: Type.String(),
});

export const ConnectionResponse = Type.Object({
    id: Type.Integer(),
    status: Type.String(),
    agency: Type.Optional(Type.Union([Type.Null(), Type.Integer()])),
    certificate: Type.Object({
        subject: Type.String(),
        validFrom: Type.String(),
        validTo: Type.String()
    }),
    created: Type.String(),
    updated: Type.String(),
    readonly: Type.Boolean(),
    username: Type.Union([Type.Null(), Type.String()]),
    name: Type.String(),
    description: Type.String(),
    enabled: Type.Boolean(),
});

export const BasemapResponse = createSelectSchema(schemas.Basemap, {
    id: Type.Integer(),
    minzoom: Type.Integer(),
    maxzoom: Type.Integer(),
    styles: Type.Array(Type.Unknown()),
    collection: Type.Optional(Type.Union([Type.Null(), Type.String()])),
    sharing_token: Type.Optional(Type.Union([Type.Null(), Type.String()])),
});

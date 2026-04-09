import { createSelectSchema } from 'drizzle-typebox';
import { Type, Static } from '@sinclair/typebox'
import * as schemas from './schema.js';
import { TAKGroup, TAKRole } from '@tak-ps/node-tak/lib/api/types';
import { Profile_Coordinate, Profile_Projection, Profile_Menu_Visibility, Profile_Zoom, Profile_Style, Profile_Stale, Profile_Distance, Profile_Elevation, Profile_Speed, Profile_Text } from './enums.js';
import { VideoLease_SourceType} from './enums.js';
import { AugmentedData } from './models/Data.js';
import { AugmentedLayer, AugmentedLayerIncoming, AugmentedLayerOutgoing } from './models/Layer.js';
import { Basemap_Format, Basemap_Protocol, Basemap_Scheme, Basemap_Type } from '../lib/enums.js';
import { Feature } from '@tak-ps/node-cot';

export const LayerResponse = AugmentedLayer;
export const LayerIncomingResponse = AugmentedLayerIncoming;
export const LayerOutgoingResponse = AugmentedLayerOutgoing;
export const DataResponse = AugmentedData;

export const GeoJSONFeatureGeometryPoint = Type.Object({
    type: Type.Literal('Point'),
    coordinates: Type.Tuple([Type.Number(), Type.Number()])
});

export const GeoJSONFeatureGeometryMultiPoint = Type.Object({
    type: Type.Literal('MultiPoint'),
    coordinates: Type.Array(Type.Tuple([Type.Number(), Type.Number()]))
});

export const GeoJSONFeatureGeometryLineString = Type.Object({
    type: Type.Literal('LineString'),
    coordinates: Type.Array(Type.Tuple([Type.Number(), Type.Number()]))
});

export const GeoJSONFeatureGeometryMultiLineString = Type.Object({
    type: Type.Literal('MultiLineString'),
    coordinates: Type.Array(Type.Array(Type.Tuple([Type.Number(), Type.Number()])))
});

export const GeoJSONFeatureGeometryPolygon = Type.Object({
    type: Type.Literal('Polygon'),
    coordinates: Type.Array(Type.Array(Type.Tuple([Type.Number(), Type.Number()])))
});

export const GeoJSONFeatureGeometryMultiPolygon = Type.Object({
    type: Type.Literal('MultiPolygon'),
    coordinates: Type.Array(Type.Array(Type.Array(Type.Tuple([Type.Number(), Type.Number()]))))
});

export const MultiGeoJSONFeature = Type.Object({
    id: Type.Optional(Type.Union([Type.Number(), Type.String()])),
    type: Type.Literal('Feature'),
    properties: Type.Record(Type.String(), Type.Unknown()),
    geometry: Type.Union([
        GeoJSONFeatureGeometryPoint,
        GeoJSONFeatureGeometryMultiPoint,
        GeoJSONFeatureGeometryLineString,
        GeoJSONFeatureGeometryMultiLineString,
        GeoJSONFeatureGeometryPolygon,
        GeoJSONFeatureGeometryMultiPolygon
    ])
});

export const MultiGeoJSONFeatureCollection = Type.Object({
    type: Type.Literal('FeatureCollection'),
    features: Type.Array(MultiGeoJSONFeature)
});

export const GeoJSONFeature = Type.Object({
    id: Type.Optional(Type.Union([Type.Number(), Type.String()])),
    type: Type.Literal('Feature'),
    properties: Type.Record(Type.String(), Type.Unknown()),
    geometry: Feature.Geometry
})

export const GeoJSONFeatureCollection = Type.Object({
    type: Type.Literal('FeatureCollection'),
    features: Type.Array(GeoJSONFeature)
});

const OptionalVectorLayer = Type.Object({
    id: Type.String(),
    fields: Type.Record(Type.String(), Type.String()),
    minzoom: Type.Optional(Type.Integer()),
    maxzoom: Type.Optional(Type.Integer()),
    description: Type.Optional(Type.String())
});

export const OptionalTileJSON = Type.Object({
    name: Type.Optional(Type.String()),
    type: Type.Optional(Type.Enum(Basemap_Type)),
    url: Type.Optional(Type.String()),
    attribution: Type.Optional(Type.String()),
    bounds: Type.Optional(Type.Any()),
    center: Type.Optional(Type.Any()),
    minzoom: Type.Optional(Type.Integer()),
    maxzoom: Type.Optional(Type.Integer()),
    style: Type.Optional(Type.Enum(Basemap_Scheme)),
    format: Type.Optional(Type.Enum(Basemap_Format)),
    vector_layers: Type.Optional(Type.Array(OptionalVectorLayer))
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

export const MissionTemplateResponse = Type.Object({
    id: Type.String(),
    name: Type.String(),
    icon: Type.String(),
    keywords: Type.Array(Type.String()),
    description: Type.String(),
    created: Type.String(),
    updated: Type.String(),
})

export const MissionTemplateLogResponse = Type.Object({
    id: Type.String(),
    name: Type.String(),
    icon: Type.Union([Type.Null(), Type.String()]),
    keywords: Type.Array(Type.String()),
    description: Type.String(),
    created: Type.String(),
    updated: Type.String(),
    template: Type.String(),
    schema: Type.Unknown(),
})

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
    username_internal: Type.Boolean(),
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

export const ProfileListResponse = Type.Object({
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
});

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

    menu_order: Type.Array(Type.Object({
        key: Type.String({
            description: 'Menu Key'
        }),
        visibility: Type.Enum(Profile_Menu_Visibility, {
            description: 'Menu Visibility',
            default: Profile_Menu_Visibility.FULL
        })
    })),

    display_projection: Type.Enum(Profile_Projection),
    display_zoom: Type.Enum(Profile_Zoom),
    display_style: Type.Enum(Profile_Style),
    display_coordinate: Type.Enum(Profile_Coordinate),
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
    source_type: Type.Enum(VideoLease_SourceType)
});

export const ProfileOverlayResponse = createSelectSchema(schemas.ProfileOverlay, {
    id: Type.Integer(),
    pos: Type.Integer(),
    frequency: Type.Union([Type.Null(), Type.Integer()]),
    iconset: Type.Union([Type.Null(), Type.String()]),
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

export const ImportResult = createSelectSchema(schemas.ImportResult);

const BaseImport = createSelectSchema(schemas.Import, {
    config: Type.Unknown(),
    error: Type.Optional(Type.Union([Type.Null(), Type.String()])),
    source_id: Type.Optional(Type.Union([Type.Null(), Type.String()])),
});

export const ImportResponse = Type.Composite([
    BaseImport,
    Type.Object({
        results: Type.Array(ImportResult)
    })
]);

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
    iconset: Type.Union([Type.Null(), Type.String()]),
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

export const BasemapResponse = Type.Object({
    id: Type.Integer(),
    created: Type.String(),
    updated: Type.String(),
    name: Type.String(),
    url: Type.String(),
    protocol: Type.Enum(Basemap_Protocol),
    bounds: Type.Any(),
    center: Type.Any(),
    minzoom: Type.Integer(),
    maxzoom: Type.Integer(),
    format: Type.Enum(Basemap_Format),
    type: Type.Enum(Basemap_Type),
    username: Type.Union([Type.Null(), Type.String()]),
    sharing_enabled: Type.Boolean(),
    sharing_token: Type.Union([Type.Null(), Type.String()]), // Explicitly Nullable
    hidden: Type.Boolean(),
    tilesize: Type.Integer(),
    attribution: Type.Union([Type.Null(), Type.String()]),
    collection: Type.Union([Type.Null(), Type.String()]),
    frequency: Type.Union([Type.Null(), Type.Integer()]),
    scheme: Type.Enum(Basemap_Scheme),
    overlay: Type.Boolean(),
    
    // Vector
    styles: Type.Optional(Type.Array(Type.Unknown())),
    iconset: Type.Optional(Type.Union([Type.Null(), Type.String()])),
    title: Type.Optional(Type.String()),
    snapping_enabled: Type.Optional(Type.Boolean()),
    snapping_layer: Type.Optional(Type.Union([Type.Null(), Type.String()]))
});

export const FullConfig = Type.Object({
    'geofence::enabled': Type.Boolean({ description: 'Enable Geofence Server Integration' }),
    'geofence::url': Type.String({ description: 'Geofence Server URL' }),
    'geofence::password': Type.String({ description: 'Geofence Server Password' }),
    'retention::enabled': Type.Boolean({ description: 'Enable scheduled retention processing' }),
    'retention::connection-feature::enabled': Type.Boolean({ description: 'Enable retention processing for connection features' }),
    'agol::enabled': Type.Boolean({ description: 'Enable ArcGIS Online Integration' }),
    'agol::auth_method': Type.String({ description: 'AGOL Auth Type', enum: ['oauth2', 'legacy'] }),
    'agol::token': Type.String({ description: 'AGOL Legacy Token' }),
    'agol::client_id': Type.String({ description: 'AGOL OAuth2 Client ID' }),
    'agol::client_secret': Type.String({ description: 'AGOL OAuth2 Client Secret' }),
    'media::url': Type.String({ description: 'Base URL for Media Service' }),
    'map::center': Type.String({ description: 'Map Center Coordinates (lng,lat)' }),
    'map::pitch': Type.Integer({ description: 'Default Map Pitch Angle', minimum: 0, maximum: 90 }),
    'map::bearing': Type.Integer({ description: 'Default Map Bearing', minimum: 0, maximum: 360 }),
    'map::zoom': Type.Number({ description: 'Default Map Zoom Level', minimum: 0, maximum: 20 }),
    'map::basemap': Type.Union([Type.Null(), Type.Integer()], { description: 'Default Basemap for New Users' }),
    'display::stale': Type.Enum(Profile_Stale),
    'display::distance': Type.Enum(Profile_Distance),
    'display::elevation': Type.Enum(Profile_Elevation),
    'display::speed': Type.Enum(Profile_Speed),
    'display::projection': Type.Enum(Profile_Projection),
    'display::zoom': Type.Enum(Profile_Zoom),
    'display::style': Type.Enum(Profile_Style),
    'display::coordinate': Type.Enum(Profile_Coordinate),
    'display::text': Type.Enum(Profile_Text),
    'display::icon_rotation': Type.Boolean(),
    'group::Yellow': Type.String(),
    'group::Cyan': Type.String(),
    'group::Green': Type.String(),
    'group::Red': Type.String(),
    'group::Purple': Type.String(),
    'group::Orange': Type.String(),
    'group::Blue': Type.String(),
    'group::Magenta': Type.String(),
    'group::White': Type.String(),
    'group::Maroon': Type.String(),
    'group::Dark Blue': Type.String(),
    'group::Teal': Type.String(),
    'group::Dark Green': Type.String(),
    'group::Brown': Type.String(),
    'oidc::enabled': Type.Boolean({ description: 'Enable OIDC Authentication' }),
    'oidc::enforced': Type.Boolean({ description: 'Disable Username/Password Login' }),
    'oidc::name': Type.String({ description: 'OIDC Provider Name' }),
    'oidc::discovery': Type.String({ description: 'OIDC Discovery URL' }),
    'oidc::client': Type.String({ description: 'OIDC Client ID' }),
    'oidc::secret': Type.String({ description: 'OIDC Client Secret' }),
    'oidc::redirect': Type.String({ description: 'OIDC App Redirect URL' }),
    'oidc::scopes': Type.String({ description: 'OIDC Scopes' }),
    'oidc::logo': Type.String({ description: 'Base64 encoded PNG for OIDC Logo' }),
    'provider::url': Type.String(),
    'provider::secret': Type.String(),
    'provider::client': Type.String(),
    'proxy::enabled': Type.Boolean({ description: 'Enable plugin proxy requests to admin-allowed origins' }),
    'proxy::whitelist': Type.Array(Type.String({ description: 'Allowed proxy origin (scheme + host + optional port)' })),
    'login::signup': Type.String({ description: 'URL for Signup Page' }),
    'login::forgot': Type.String({ description: 'URL for Forgot Password Page' }),
    'login::name': Type.String({ description: 'Login Page Title' }),
    'login::username': Type.String({ description: 'Custom Label for Username Field' }),
    'login::brand::enabled': Type.String({ description: 'Enable Custom Branding on Login Page', enum: ['default', 'enabled', 'disabled'] }),
    'login::brand::logo': Type.String({ description: 'Show or Hide the CloudTAK Branding' }),
    'login::background::enabled': Type.Boolean({ description: 'Enable or Disable Custom Background on Login Page' }),
    'login::background::color': Type.String({ description: 'Hex Color Code for Login Background' }),
    'login::logo': Type.String({ description: 'Base64 encoded PNG for Logo' }),
    'external::applications': Type.Array(Type.Object({
        name: Type.String({ description: 'Application Name' }),
        icon: Type.String({ description: 'Base64 encoded icon' }),
        url: Type.String({ description: 'Application URL' }),
    }), { description: 'External application links' }),
});

export type FullConfigType = Static<typeof FullConfig>;
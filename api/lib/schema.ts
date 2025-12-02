import { sql } from 'drizzle-orm';
import { primaryKey } from "drizzle-orm/pg-core";
import { Static } from '@sinclair/typebox'
import type { StyleContainer } from './style.js';
import type { FilterContainer } from './filter.js';
import type { PaletteFeatureStyle } from './palette.js';
import { Polygon, Point } from 'geojson';
import { ImportResult } from './control/import.js'
import { geometry, GeometryType } from '@openaddresses/batch-generic';
import { ConnectionAuth } from './connection-config.js';
import { TAKGroup, TAKRole } from  '@tak-ps/node-tak/lib/api/types';
import { Layer_Config } from './models/Layer.js';
import {
    Layer_Priority,
    Import_Status,
    Profile_Stale, Profile_Speed, Profile_Elevation, Profile_Distance, Profile_Text, Profile_Projection, Profile_Zoom,
    Basemap_Type, Basemap_Format, Basemap_Scheme, VideoLease_SourceType, BasicGeometryType
} from  './enums.js';
import { json, boolean, uuid, numeric, integer, timestamp, pgTable, serial, varchar, text, unique, index } from 'drizzle-orm/pg-core';

/** Internal Tables for Postgis for use with drizzle-kit push:pg */
export const SpatialRefSys = pgTable('spatial_ref_sys', {
    srid: integer().primaryKey(),
    auth_name: varchar({ length: 256 }),
    auth_srid: integer(),
    srtext: varchar({ length: 2048 }),
    proj4text: varchar({ length: 2048 })
});


export const Palette = pgTable('palette', {
    uuid: uuid().primaryKey().default(sql`gen_random_uuid()`),
    name: text().notNull(),
    created: timestamp({ withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    updated: timestamp({ withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
});

export const PaletteFeature = pgTable('palette_feature', {
    uuid: uuid().primaryKey().default(sql`gen_random_uuid()`),
    created: timestamp({ withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    updated: timestamp({ withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    name: text().notNull(),
    palette: uuid().notNull().references(() => Palette.uuid),
    type: text().$type<BasicGeometryType>().notNull(),
    style: json().$type<Static<typeof PaletteFeatureStyle>>().notNull().default({})
});

export const MissionTemplate = pgTable('mission_template', {
    id: uuid().primaryKey().default(sql`gen_random_uuid()`),
    name: text().notNull(),
    icon: text().notNull().default(''),
    description: text().notNull().default(''),
    created: timestamp({ withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    updated: timestamp({ withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
});

/** ==== END ==== */

export const Profile = pgTable('profile', {
    id: integer(),
    name: text().default('Unknown'),
    username: text().primaryKey(),
    last_login: timestamp({ withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    auth: json().$type<Static<typeof ConnectionAuth>>().notNull(),
    created: timestamp({ withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    updated: timestamp({ withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    phone: text().notNull().default(''),
    tak_callsign: text().notNull().default('CloudTAK User'),
    tak_remarks: text().notNull().default('CloudTAK User'),
    tak_group: text().$type<TAKGroup>().notNull().default(TAKGroup.ORANGE),
    tak_role: text().$type<TAKRole>().notNull().default(TAKRole.TEAM_MEMBER),
    tak_type: text().notNull().default('a-f-G-E-V-C'),
    tak_loc: geometry({ srid: 4326, type: GeometryType.Point }),
    tak_loc_freq: integer().notNull().default(2000),
    display_stale: text().$type<Profile_Stale>().notNull().default(Profile_Stale.TenMinutes),
    display_distance: text().$type<Profile_Distance>().notNull().default(Profile_Distance.MILE),
    display_elevation: text().$type<Profile_Elevation>().notNull().default(Profile_Elevation.FEET),
    display_speed: text().$type<Profile_Speed>().notNull().default(Profile_Speed.MPH),
    display_projection: text().$type<Profile_Projection>().notNull().default(Profile_Projection.GLOBE),
    display_zoom: text().$type<Profile_Zoom>().notNull().default(Profile_Zoom.CONDITIONAL),
    display_icon_rotation: boolean().notNull().default(true),
    display_text: text().$type<Profile_Text>().notNull().default(Profile_Text.Medium),
    system_admin: boolean().notNull().default(false),
    agency_admin: json().notNull().$type<Array<number>>().default([])
});

export const ProfileFile = pgTable('profile_files', {
    id: uuid().primaryKey().default(sql`gen_random_uuid()`),
    created: timestamp({ withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    updated: timestamp({ withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    username: text().notNull().references(() => Profile.username),
    path: text().notNull().default('/'),
    name: text().notNull(),
    size: integer().notNull(),
    artifacts: json().$type<Array<{
        ext: string;
        size: number;
    }>>().notNull().default([]),
});

export const ProfileChat = pgTable('profile_chats', {
    id: serial().primaryKey(),
    read: boolean().notNull().default(false),
    username: text().notNull().references(() => Profile.username),
    chatroom: text().notNull(),
    sender_callsign: text().notNull(),
    sender_uid: text().notNull(),
    created: timestamp({ withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    updated: timestamp({ withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    message_id: text().notNull(),
    message: text().notNull()
});

export const VideoLease = pgTable('video_lease', {
    id: serial().primaryKey(),
    name: text().notNull(),
    created: timestamp({ withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    updated: timestamp({ withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),

    username: text().references(() => Profile.username),
    connection: integer().references(() => Connection.id),
    layer: integer().references(() => Layer.id),

    source_id: text(),
    source_type: text().$type<VideoLease_SourceType>().notNull().default(VideoLease_SourceType.UNKNOWN),
    source_model: text().notNull().default(''),

    // Publish to the TAK Server Video Config API
    publish: boolean().notNull().default(false),
    recording: boolean().notNull().default(false),

    ephemeral: boolean().notNull().default(false),
    channel: text().default(sql`null`),

    expiration: timestamp({ withTimezone: true, mode: 'string' }).default(sql`Now() + INTERVAL 1 HOUR;`),
    path: text().notNull(),

    stream_user: text(),
    stream_pass: text(),

    read_user: text(),
    read_pass: text(),

    // Optional Proxy Mode
    proxy: text().default(sql`null`),
});

export const ProfileVideo = pgTable('profile_videos', {
    id: uuid().primaryKey().default(sql`gen_random_uuid()`),
    created: timestamp({ withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    updated: timestamp({ withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    lease: integer().notNull().references(() => VideoLease.id),
    username: text().notNull().references(() => Profile.username),
}, (table) => {
    return {
        username_idx: index("profile_videos_username_idx").on(table.username),
    }
})

export const ProfileFeature = pgTable('profile_features', {
    id: text().notNull(),
    path: text().notNull().default('/'),
    deleted: boolean().notNull().default(false),
    username: text().notNull().references(() => Profile.username),
    properties: json().notNull().default({}),
    geometry: geometry({ type: GeometryType.GeometryZ, srid: 4326 }).notNull()
}, (table) => {
    return {
        pk: primaryKey({
            columns: [table.username, table.id]
        }),
        username_idx: index("profile_features_username_idx").on(table.username),
    }
})

export const Basemap = pgTable('basemaps', {
    id: serial().primaryKey(),
    created: timestamp({ withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    updated: timestamp({ withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    sharing_enabled: boolean().notNull().default(false),
    sharing_token: text(),
    name: text().notNull(),
    title: text().notNull().default('callsign'), // Title of features within the layer
    url: text().notNull(),
    overlay: boolean().notNull().default(false),
    username: text().references(() => Profile.username),
    bounds: geometry({ type: GeometryType.Polygon, srid: 4326 }).$type<Polygon>(),
    tilesize: integer().notNull().default(256),
    frequency: integer(),
    attribution: text(),
    center: geometry({ type: GeometryType.Point, srid: 4326 }).$type<Point>(),
    minzoom: integer().notNull().default(0),
    maxzoom: integer().notNull().default(16),
    collection: text(),
    format: text().$type<Basemap_Format>().notNull().default(Basemap_Format.PNG),
    scheme: text().$type<Basemap_Scheme>().notNull().default(Basemap_Scheme.XYZ),
    styles: json().$type<Array<unknown>>().notNull().default([]),
    type: text().$type<Basemap_Type>().notNull().default(Basemap_Type.RASTER)
}, (table) => {
    return {
        username_idx: index("basemaps_username_idx").on(table.username),
    }
})

export const Errors = pgTable('errors', {
    id: serial().primaryKey(),
    created: timestamp({ withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    updated: timestamp({ withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    username: text().notNull().references(() => Profile.username),
    message: text().notNull(),
    trace: text()
})

export const Import = pgTable('imports', {
    id: text().primaryKey(),
    created: timestamp({ withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    updated: timestamp({ withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    name: text().notNull(),
    status: text().notNull().default(Import_Status.PENDING),
    error: text(),
    result: json().$type<Static<typeof ImportResult>>().notNull().default({}),
    username: text().notNull().references(() => Profile.username),
    source: text().notNull().default('Upload'),
    source_id: text(),
    config: json().notNull().default({})
});

export const Task = pgTable('tasks', {
    id: serial().primaryKey(),
    prefix: text().notNull(),
    favorite: boolean().notNull().default(false),
    created: timestamp({ withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    updated: timestamp({ withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    name: text().notNull(),
    logo: text(),
    repo: text(),
    readme: text()
}, (t) => ({
    unq: unique().on(t.prefix)
}));

export const Iconset = pgTable('iconsets', {
    uid: text().primaryKey(),
    created: timestamp({ withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    updated: timestamp({ withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    version: integer().notNull(),
    name: text().notNull(),
    username: text().references(() => Profile.username),
    default_group: text(),
    default_friendly: text(),
    default_hostile: text(),
    default_neutral: text(),
    default_unknown: text(),
    skip_resize: boolean().notNull().default(false),

    spritesheet_data: text(),
    spritesheet_json: json(),
}, (table) => {
    return {
        username_idx: index("iconsets_username_idx").on(table.username),
    }
});


export const Icon = pgTable('icons', {
    id: serial().primaryKey(),
    created: timestamp({ withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    updated: timestamp({ withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    name: text().notNull(),
    iconset: text().notNull().references(() => Iconset.uid),
    type2525b: text(),
    data: text().notNull(),
    path: text().notNull()
});

export const Connection = pgTable('connections', {
    id: serial().primaryKey(),
    readonly: boolean().notNull().default(false),
    agency: integer(),
    created: timestamp({ withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    updated: timestamp({ withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    username: text().references(() => Profile.username),
    name: text().notNull(),
    description: text().notNull().default(''),
    enabled: boolean().notNull().default(true),
    auth: json().$type<Static<typeof ConnectionAuth>>().notNull()
});

export const ConnectionFeature = pgTable('connection_features', {
    id: text().notNull(),
    path: text().notNull().default('/'),
    connection: integer().notNull().references(() => Connection.id),
    properties: json().notNull().default({}),
    geometry: geometry({ type: GeometryType.GeometryZ, srid: 4326 }).notNull()
}, (table) => {
    return {
        pk: primaryKey({
            columns: [table.connection, table.id]
        }),
        connection_idx: index("connection_features_connection_idx").on(table.connection),
    }
})

export const Data = pgTable('data', {
    id: serial().primaryKey(),
    created: timestamp({ withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    updated: timestamp({ withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    username: text().references(() => Profile.username),
    name: text().notNull(),
    description: text().notNull().default(''),
    mission_sync: boolean().notNull().default(false),
    mission_diff: boolean().notNull().default(false),
    mission_role: text().notNull().default('MISSION_SUBSCRIBER'),
    mission_token: text(),
    mission_groups: text().array().notNull().default([]),
    assets: json().$type<Array<string>>().notNull().default(["*"]),
    connection: integer().notNull().references(() => Connection.id)
});

export const Layer = pgTable('layers', {
    id: serial().primaryKey(),
    uuid: uuid().notNull().default(sql`gen_random_uuid()`),
    created: timestamp({ withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    updated: timestamp({ withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    username: text().references(() => Profile.username),
    name: text().notNull(),
    enabled: boolean().notNull().default(true),
    description: text().notNull().default(''),
    priority: text().$type<Layer_Priority>().notNull().default(Layer_Priority.OFF),
    template: boolean().notNull().default(false),
    connection: integer().references(() => Connection.id),
    logging: boolean().notNull().default(true),
    task: text().notNull(),
    memory: integer().notNull().default(256),
    timeout: integer().notNull().default(120),

    alarm_period: integer().notNull().default(30),
    alarm_evals: integer().notNull().default(5),
    alarm_points: integer().notNull().default(4),
}, (t) => ({
    unq: unique().on(t.connection, t.name)
}));

export const LayerOutgoing = pgTable('layers_outgoing', {
    layer: integer().primaryKey().references(() => Layer.id),
    created: timestamp({ withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    updated: timestamp({ withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),

    filters: json().$type<Static<typeof FilterContainer>>().notNull().default({}),

    environment: json().notNull().default({}),
    ephemeral: json().$type<Record<string, any>>().notNull().default({}),
});

export const LayerIncoming = pgTable('layers_incoming', {
    layer: integer().primaryKey().references(() => Layer.id),
    created: timestamp({ withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    updated: timestamp({ withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),

    cron: text(),
    webhooks: boolean().notNull().default(false),

    enabled_styles: boolean().notNull().default(false),
    styles: json().$type<Static<typeof StyleContainer>>().notNull().default({}),
    environment: json().notNull().default({}),
    ephemeral: json().$type<Record<string, any>>().notNull().default({}),
    config: json().$type<Static<typeof Layer_Config>>().notNull().default({}),

    // Data Destinations
    data: integer().references(() => Data.id),
    // Empty Array = All Groups
    groups: text().array().notNull().default([]),
});

export const Setting = pgTable('settings', {
    key: text().primaryKey(),
    value: text().notNull().default('')
});

export const Server = pgTable('server', {
    id: serial().primaryKey(),
    created: timestamp({ withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    updated: timestamp({ withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    name: text().notNull().default('Default'),
    url: text().notNull(),
    auth: json().$type<{
        cert?: string;
        key?: string;
    }>().notNull().default({}),
    api: text().notNull().default(''),
    webtak: text().notNull().default(''),
});

export const ConnectionToken = pgTable('connection_tokens', {
    id: serial().notNull(),
    connection: integer().notNull().references(() => Connection.id),
    name: text().notNull(),
    token: text().primaryKey(),
    created: timestamp({ withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    updated: timestamp({ withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
});

export const FusionType = pgTable('fusion_type', {
    id: serial().primaryKey(),
    name: text().notNull(),
    schema: json().notNull()
});

export const ProfileFusionSource = pgTable('profile_fusion', {
    id: serial().primaryKey(),
    username: text().notNull().references(() => Profile.username),
    fusion: integer().notNull().references(() => FusionType.id),
    value: json().$type<Record<string, string>>().notNull().default({}),
});

export const ProfileToken = pgTable('profile_tokens', {
    id: serial().notNull(),
    created: timestamp({ withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    updated: timestamp({ withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    username: text().notNull().references(() => Profile.username),
    name: text().notNull(),
    token: text().primaryKey(),
});


export const ProfileInterest = pgTable('profile_interests', {
    id: serial().primaryKey(),
    name: text().notNull(),
    username: text().notNull().references(() => Profile.username),
    bounds: geometry({ type: GeometryType.Polygon, srid: 4326 }).$type<Polygon>().notNull(),
    created: timestamp({ withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    updated: timestamp({ withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
});

export const ProfileOverlay = pgTable('profile_overlays', {
    id: serial().primaryKey(),
    name: text().notNull(),
    active: boolean().notNull().default(false),
    username: text().notNull().references(() => Profile.username),
    created: timestamp({ withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    updated: timestamp({ withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    pos: integer().notNull().default(5),
    type: text().notNull().default('vector'),
    frequency: integer(),
    opacity: numeric().notNull().default('1'),
    visible: boolean().notNull().default(true),
    token: text(),
    styles: json().$type<Array<unknown>>().notNull().default([]),
    mode: text().notNull(),
    mode_id: text(), // Used for Data not for Profile
    url: text().notNull()
}, (t) => ({
    unq: unique().on(t.username, t.url)
}));

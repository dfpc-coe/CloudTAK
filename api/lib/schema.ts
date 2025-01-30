import { sql } from 'drizzle-orm';
import { Static } from '@sinclair/typebox'
import type { StyleContainer } from './style.js';
import { Polygon, Point } from 'geojson';
import { geometry, GeometryType } from '@openaddresses/batch-generic';
import { ConnectionAuth } from './connection-config.js';
import { TAKGroup, TAKRole } from  './api/types.js';
import { Layer_Config } from './models/Layer.js';
import {
    Layer_Priority,
    Profile_Stale, Profile_Speed, Profile_Elevation, Profile_Distance, Profile_Text, Profile_Projection,
    Basemap_Type, Basemap_Format, Basemap_Style,
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

/** ==== END ==== */

export const Profile = pgTable('profile', {
    id: integer(),
    name: text().default('Unknown'),
    username: text().primaryKey(),
    last_login: timestamp({ withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    auth: json().$type<ConnectionAuth>().notNull(),
    created: timestamp({ withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    updated: timestamp({ withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    phone: text().notNull().default(''),
    tak_callsign: text().notNull().default('CloudTAK User'),
    tak_remarks: text().notNull().default('CloudTAK User'),
    tak_group: text().$type<TAKGroup>().notNull().default(TAKGroup.ORANGE),
    tak_role: text().$type<TAKRole>().notNull().default(TAKRole.TEAM_MEMBER),
    tak_loc: geometry({ srid: 4326, type: GeometryType.Point }),
    tak_loc_freq: integer().notNull().default(2000),
    display_stale: text().$type<Profile_Stale>().notNull().default(Profile_Stale.TenMinutes),
    display_distance: text().$type<Profile_Distance>().notNull().default(Profile_Distance.MILE),
    display_elevation: text().$type<Profile_Elevation>().notNull().default(Profile_Elevation.FEET),
    display_speed: text().$type<Profile_Speed>().notNull().default(Profile_Speed.MPH),
    display_projection: text().$type<Profile_Projection>().notNull().default(Profile_Projection.GLOBE),
    display_text: text().$type<Profile_Text>().notNull().default(Profile_Text.Medium),
    system_admin: boolean().notNull().default(false),
    agency_admin: json().notNull().$type<Array<number>>().default([])
});

export const ProfileChat = pgTable('profile_chats', {
    id: serial().primaryKey(),
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
    username: text().notNull().references(() => Profile.username),

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

export const ProfileFeature = pgTable('profile_features', {
    id: text().primaryKey(),
    path: text().notNull().default('/'),
    username: text().notNull().references(() => Profile.username),
    properties: json().notNull().default({}),
    geometry: geometry({ type: GeometryType.GeometryZ, srid: 4326 }).notNull()
});

export const BasemapCollection = pgTable('basemaps_collection', {
    id: serial().primaryKey(),
    created: timestamp({ withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    updated: timestamp({ withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    name: text().notNull(),
})

export const Basemap = pgTable('basemaps', {
    id: serial().primaryKey(),
    created: timestamp({ withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    updated: timestamp({ withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    name: text().notNull(),
    title: text().notNull().default('callsign'), // Title of features within the layer
    url: text().notNull(),
    overlay: boolean().notNull().default(false),
    username: text().references(() => Profile.username),
    bounds: geometry({ type: GeometryType.Polygon, srid: 4326 }).$type<Polygon>(),
    center: geometry({ type: GeometryType.Point, srid: 4326 }).$type<Point>(),
    minzoom: integer().notNull().default(0),
    maxzoom: integer().notNull().default(16),
    collection: integer().references(() => BasemapCollection.id),
    format: text().$type<Basemap_Format>().notNull().default(Basemap_Format.PNG),
    style: text().$type<Basemap_Style>().notNull().default(Basemap_Style.ZXY),
    styles: json().$type<Array<unknown>>().notNull().default([]),
    type: text().$type<Basemap_Type>().notNull().default(Basemap_Type.RASTER)
}, (table) => {
    return {
        username_idx: index("basemaps_username_idx").on(table.username),
    }
})

export const Import = pgTable('imports', {
    id: text().primaryKey(),
    created: timestamp({ withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    updated: timestamp({ withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    name: text().notNull(),
    status: text().notNull().default('Pending'),
    error: text(),
    batch: text(),
    result: json().notNull().default({}),
    username: text().notNull().references(() => Profile.username),
    mode: text().notNull().default('Unknown'),
    mode_id: text(),
    config: json().notNull().default({})
});

export const Task = pgTable('tasks', {
    id: serial().primaryKey(),
    prefix: text().notNull(),
    created: timestamp({ withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    updated: timestamp({ withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    name: text().notNull(),
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
    skip_resize: boolean().notNull().default(false)
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
    data_alt: text(),
    path: text().notNull()
});

export const Connection = pgTable('connections', {
    id: serial().primaryKey(),
    agency: integer(),
    created: timestamp({ withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    updated: timestamp({ withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    name: text().notNull(),
    description: text().notNull().default(''),
    enabled: boolean().notNull().default(true),
    auth: json().$type<ConnectionAuth>().notNull()
});

export const ConnectionSink = pgTable('connection_sinks', {
    id: serial().primaryKey(),
    created: timestamp({ withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    updated: timestamp({ withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    name: text().notNull(),
    enabled: boolean().notNull().default(true),
    connection: integer().notNull().references(() => Connection.id),
    type: text().notNull(),
    body: json().$type<Record<string, string>>().notNull().default({}),
    logging: boolean().notNull().default(false)
});

export const Data = pgTable('data', {
    id: serial().primaryKey(),
    created: timestamp({ withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    updated: timestamp({ withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    name: text().notNull(),
    description: text().notNull().default(''),
    auto_transform: boolean().notNull().default(false),
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
    name: text().notNull(),
    enabled: boolean().notNull().default(true),
    description: text().notNull().default(''),
    priority: text().$type<Layer_Priority>().notNull().default(Layer_Priority.OFF),
    connection: integer().notNull().references(() => Connection.id),
    logging: boolean().notNull().default(true),
    task: text().notNull(),
    memory: integer().notNull().default(128),
    timeout: integer().notNull().default(128),
}, (t) => ({
    unq: unique().on(t.connection, t.name)
}));

export const LayerIncoming = pgTable('layers_incoming', {
    layer: integer().primaryKey().references(() => Layer.id),

    cron: text(),
    webhooks: boolean().notNull().default(false),

    alarm_period: integer().notNull().default(30),
    alarm_evals: integer().notNull().default(5),
    alarm_points: integer().notNull().default(4),
    alarm_threshold: integer().notNull().default(0),

    enabled_styles: boolean().notNull().default(false),
    styles: json().$type<Static<typeof StyleContainer>>().notNull().default({}),
    stale: integer().notNull().default(20),
    environment: json().notNull().default({}),
    ephemeral: json().$type<Record<string, string>>().notNull().default({}),
    config: json().$type<Static<typeof Layer_Config>>().notNull().default({}),
    schema: json().notNull().default({ type: 'object', required: [], properties: {} }),
    data: integer().references(() => Data.id)
});

export const LayerTemplate = pgTable('layers_template', {
    id: serial().primaryKey(),
    created: timestamp({ withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    updated: timestamp({ withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    name: text().notNull(),
    description: text().notNull().default(''),

    username: text().notNull().references(() => Profile.username),

    // Should the template be used when attached to a DataSync
    datasync: boolean().notNull().default(false),

    // Layer Specific Properties
    priority: text().$type<Layer_Priority>().notNull().default(Layer_Priority.OFF),
    enabled_styles: boolean().notNull().default(false),
    styles: json().$type<Static<typeof StyleContainer>>().notNull().default({}),
    logging: boolean().notNull().default(true),
    stale: integer().notNull().default(20),
    task: text().notNull(),
    cron: text(),
    webhooks: boolean().notNull().default(false),
    config: json().$type<Static<typeof Layer_Config>>().notNull().default({}),
    memory: integer().notNull().default(128),
    timeout: integer().notNull().default(128),
    alarm_period: integer().notNull().default(30),
    alarm_evals: integer().notNull().default(5),
    alarm_points: integer().notNull().default(4),
    alarm_threshold: integer().notNull().default(0),
});


export const LayerAlert = pgTable('layer_alerts', {
    id: serial().primaryKey(),
    created: timestamp({ withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    updated: timestamp({ withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    layer: integer().notNull().references(() => Layer.id),
    icon: text().notNull().default('alert-circle'),
    priority: text().notNull().default('yellow'),
    title: text().notNull(),
    description: text().notNull().default('Details Unknown'),
    hidden: boolean().notNull().default(false)
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

export const Token = pgTable('tokens', {
    id: serial().notNull(),
    email: text().notNull(),
    name: text().notNull(),
    token: text().primaryKey(),
    created: timestamp({ withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    updated: timestamp({ withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
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

export const ProfileInterest = pgTable('profile_interests', {
    id: serial().primaryKey(),
    name: text().notNull(),
    username: text().notNull().references(() => Profile.username),
    bounds: geometry({ type: GeometryType.Polygon, srid: 4326 }).$type<Polygon>(),
    created: timestamp({ withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    updated: timestamp({ withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
});

export const ProfileMission = pgTable('profile_missions', {
    id: serial().primaryKey(),
    name: text().notNull(),
    guid: text().notNull(),
    token: text().notNull(),
    created: timestamp({ withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    updated: timestamp({ withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
});

export const ProfileOverlay = pgTable('profile_overlays', {
    id: serial().primaryKey(),
    name: text().notNull(),
    username: text().notNull().references(() => Profile.username),
    created: timestamp({ withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    updated: timestamp({ withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    pos: integer().notNull().default(5),
    type: text().notNull().default('vector'),
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

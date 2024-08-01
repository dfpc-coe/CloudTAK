import { sql } from 'drizzle-orm';
import { Static } from '@sinclair/typebox'
import type { StyleContainer } from './style.js';
import { geometry, GeometryType } from '@openaddresses/batch-generic';
import { ConnectionAuth } from './connection-config.js';
import { TAKGroup, TAKRole } from  './api/types.js';
import { Layer_Priority, Profile_Stale, Profile_Speed, Profile_Elevation, Profile_Distance } from  './enums.js';
import { json, boolean, numeric, integer, timestamp, pgTable, serial, varchar, text, unique, index } from 'drizzle-orm/pg-core';

/** Internal Tables for Postgis for use with drizzle-kit push:pg */
export const SpatialRefSys = pgTable('spatial_ref_sys', {
    srid: integer('srid').primaryKey(),
    auth_name: varchar('auth_name', { length: 256 }),
    auth_srid: integer('auth_srid'),
    srtext: varchar('srtext', { length: 2048 }),
    proj4text: varchar('proj4text', { length: 2048 })
});

/** ==== END ==== */

export const Profile = pgTable('profile', {
    id: integer('id'),
    name: text('name').default('Unknown'),
    username: text('username').primaryKey(),
    last_login: timestamp('last_login', { withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    auth: json('auth').$type<ConnectionAuth>().notNull(),
    created: timestamp('created', { withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    updated: timestamp('updated', { withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    phone: text('phone').default(''),
    tak_callsign: text('tak_callsign').notNull().default('CloudTAK User'),
    tak_group: text('tak_group').$type<TAKGroup>().notNull().default(TAKGroup.ORANGE),
    tak_role: text('tak_role').$type<TAKRole>().notNull().default(TAKRole.TEAM_MEMBER),
    tak_loc: geometry('tak_loc', { srid: 4326, type: GeometryType.Point }),
    display_stale: text('display_stale').$type<Profile_Stale>().notNull().default(Profile_Stale.TenMinutes),
    display_distance: text('display_distance').$type<Profile_Distance>().notNull().default(Profile_Distance.MILE),
    display_elevation: text('display_elevation').$type<Profile_Elevation>().notNull().default(Profile_Elevation.FEET),
    display_speed: text('display_speed').$type<Profile_Speed>().notNull().default(Profile_Speed.MPH),
    system_admin: boolean('system_admin').notNull().default(false),
    agency_admin: json('agency_admin').$type<Array<number>>().default([])
});

export const ProfileChat = pgTable('profile_chats', {
    id: serial('id').primaryKey(),
    username: text('username').notNull().references(() => Profile.username),
    chatroom: text('chatroom').notNull(),
    sender_callsign: text('sender_callsign').notNull(),
    sender_uid: text('sender_uid').notNull(),
    created: timestamp('created', { withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    updated: timestamp('updated', { withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    message_id: text('message_id').notNull(),
    message: text('message').notNull()
});

export const VideoLease = pgTable('video_lease', {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    created: timestamp('created', { withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    updated: timestamp('updated', { withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    username: text('username').notNull().references(() => Profile.username),
    expiration: timestamp('expiration', { withTimezone: true, mode: 'string' }).notNull().default(sql`Now() + INTERVAL 1 HOUR;`),
    path: text('path').notNull()
});

export const ProfileFeature = pgTable('profile_features', {
    id: text('id').primaryKey(),
    path: text('path').notNull().default('/'),
    username: text('username').notNull().references(() => Profile.username),
    properties: json('properties').notNull().default({}),
    geometry: geometry('geometry', { type: GeometryType.GeometryZ, srid: 4326 }).notNull()
});

export const Basemap = pgTable('basemaps', {
    id: serial('id').primaryKey(),
    created: timestamp('created', { withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    updated: timestamp('updated', { withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    name: text('name').notNull(),
    url: text('url').notNull(),
    username: text('username').references(() => Profile.username),
    bounds: geometry('bounds', { type: GeometryType.Polygon, srid: 4326 }),
    center: geometry('center', { type: GeometryType.Point, srid: 4326 }),
    minzoom: integer('minzoom').notNull().default(0),
    maxzoom: integer('maxzoom').notNull().default(16),
    format: text('format').notNull().default('png'),
    style: text('style').notNull().default('zxy'),
    type: text('type').notNull().default('raster')
}, (table) => {
    return {
        username_idx: index("basemaps_username_idx").on(table.username),
    }
})

export const Import = pgTable('imports', {
    id: text('id').primaryKey(),
    created: timestamp('created', { withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    updated: timestamp('updated', { withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    name: text('name').notNull(),
    status: text('status').notNull().default('Pending'),
    error: text('error'),
    result: json('result').notNull().default({}),
    username: text('username').notNull().references(() => Profile.username),
    mode: text('mode').notNull().default('Unknown'),
    mode_id: text('mode_id'),
    config: json('config').notNull().default({})
});

export const Task = pgTable('tasks', {
    id: serial('id').primaryKey(),
    prefix: text('prefix').notNull(),
    created: timestamp('created', { withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    updated: timestamp('updated', { withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    name: text('name').notNull(),
    repo: text('repo'),
    readme: text('readme')
}, (t) => ({
    unq: unique().on(t.prefix)
}));

export const Iconset = pgTable('iconsets', {
    uid: text('uid').primaryKey(),
    created: timestamp('created', { withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    updated: timestamp('updated', { withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    version: integer('version').notNull(),
    name: text('name').notNull(),
    username: text('username').references(() => Profile.username),
    default_group: text('default_group'),
    default_friendly: text('default_friendly'),
    default_hostile: text('default_hostile'),
    default_neutral: text('default_neutral'),
    default_unknown: text('default_unknown'),
    skip_resize: boolean('skip_resize').notNull().default(false)
}, (table) => {
    return {
        username_idx: index("iconsets_username_idx").on(table.username),
    }
});


export const Icon = pgTable('icons', {
    id: serial('id').primaryKey(),
    created: timestamp('created', { withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    updated: timestamp('updated', { withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    name: text('name').notNull(),
    iconset: text('iconset').notNull().references(() => Iconset.uid),
    type2525b: text('type2525b'),
    data: text('data').notNull(),
    path: text('path').notNull()
});

export const Connection = pgTable('connections', {
    id: serial('id').primaryKey(),
    agency: integer('agency'),
    created: timestamp('created', { withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    updated: timestamp('updated', { withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    enabled: boolean('enabled').notNull().default(true),
    auth: json('auth').$type<ConnectionAuth>().notNull()
});

export const ConnectionSink = pgTable('connection_sinks', {
    id: serial('id').primaryKey(),
    created: timestamp('created', { withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    updated: timestamp('updated', { withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    name: text('name').notNull(),
    enabled: boolean('enabled').notNull().default(true),
    connection: integer('connection').notNull().references(() => Connection.id),
    type: text('type').notNull(),
    body: json('body').notNull().default({}),
    logging: boolean('logging').notNull().default(false)
});

export const Data = pgTable('data', {
    id: serial('id').primaryKey(),
    created: timestamp('created', { withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    updated: timestamp('updated', { withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    auto_transform: boolean('auto_transform').notNull().default(false),
    mission_sync: boolean('mission_sync').notNull().default(false),
    mission_diff: boolean('mission_diff').notNull().default(false),
    mission_role: text('mission_role').notNull().default('MISSION_SUBSCRIBER'),
    mission_token: text('mission_token'),
    mission_groups: text('mission_groups').array().notNull().default([]),
    assets: json('assets').$type<Array<string>>().notNull().default(["*"]),
    connection: integer('connection').notNull().references(() => Connection.id)
});

export const Layer = pgTable('layers', {
    id: serial('id').primaryKey(),
    created: timestamp('created', { withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    updated: timestamp('updated', { withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    name: text('name').notNull(),
    priority: text('priority').$type<Layer_Priority>().notNull().default(Layer_Priority.OFF),
    alarm_period: integer('alarm_period').notNull().default(30),
    alarm_evals: integer('alarm_evals').notNull().default(5),
    alarm_points: integer('alarm_points').notNull().default(4),
    alarm_threshold: integer('alarm_threshold').notNull().default(0),
    description: text('description').notNull().default(''),
    enabled: boolean('enabled').notNull().default(true),
    enabled_styles: boolean('enabled_styles').notNull().default(false),
    styles: json('styles').$type<Static<typeof StyleContainer>>().notNull().default({}),
    logging: boolean('logging').notNull().default(true),
    stale: integer('stale').notNull().default(20),
    task: text('task').notNull(),
    connection: integer('connection').notNull().references(() => Connection.id),
    cron: text('cron').notNull(),
    environment: json('environment').notNull().default({}),
    config: json('config').notNull().default({}),
    memory: integer('memory').notNull().default(128),
    timeout: integer('timeout').notNull().default(128),
    data: integer('data').references(() => Data.id),
    schema: json('schema').notNull().default({ type: 'object', required: [], properties: {} })
}, (t) => ({
    unq: unique().on(t.connection, t.name)
}));

export const LayerTemplate = pgTable('layers_template', {
    id: serial('id').primaryKey(),
    created: timestamp('created', { withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    updated: timestamp('updated', { withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),

    username: text('username').notNull().references(() => Profile.username),

    // Should the template be used when attached to a DataSync
    datasync: boolean('datasync').notNull().default(false),

    // Layer Specific Properties
    priority: text('priority').$type<Layer_Priority>().notNull().default(Layer_Priority.OFF),
    enabled_styles: boolean('enabled_styles').notNull().default(false),
    styles: json('styles').$type<Static<typeof StyleContainer>>().notNull().default({}),
    logging: boolean('logging').notNull().default(true),
    stale: integer('stale').notNull().default(20),
    task: text('task').notNull(),
    cron: text('cron').notNull(),
    config: json('config').notNull().default({}),
    memory: integer('memory').notNull().default(128),
    timeout: integer('timeout').notNull().default(128),
    alarm_period: integer('alarm_period').notNull().default(30),
    alarm_evals: integer('alarm_evals').notNull().default(5),
    alarm_points: integer('alarm_points').notNull().default(4),
    alarm_threshold: integer('alarm_threshold').notNull().default(0),
});


export const LayerAlert = pgTable('layer_alerts', {
    id: serial('id').primaryKey(),
    created: timestamp('created', { withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    updated: timestamp('updated', { withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    layer: integer('layer').notNull().references(() => Layer.id),
    icon: text('icon').notNull().default('alert-circle'),
    priority: text('priority').notNull().default('yellow'),
    title: text('title').notNull(),
    description: text('description').notNull().default('Details Unknown'),
    hidden: boolean('hidden').notNull().default(false)
});

export const Setting = pgTable('settings', {
    key: text('key').primaryKey(),
    value: text('value').notNull().default('')
});

export const Server = pgTable('server', {
    id: serial('id').primaryKey(),
    created: timestamp('created', { withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    updated: timestamp('updated', { withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    name: text('name').notNull().default('Default'),
    url: text('url').notNull(),
    auth: json('auth').$type<{
        cert?: string;
        key?: string;
    }>().notNull().default({}),
    api: text('api').notNull().default(''),
    provider_url: text('provider_url').notNull().default(''),
    provider_secret: text('provider_secret').notNull().default(''),
    provider_client: text('provider_client').notNull().default(''),
});

export const Token = pgTable('tokens', {
    id: serial('id').notNull(),
    email: text('email').notNull(),
    name: text('name').notNull(),
    token: text('token').primaryKey(),
    created: timestamp('created', { withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    updated: timestamp('updated', { withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
});

export const ConnectionToken = pgTable('connection_tokens', {
    id: serial('id').notNull(),
    connection: integer('connection').notNull().references(() => Connection.id),
    name: text('name').notNull(),
    token: text('token').primaryKey(),
    created: timestamp('created', { withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    updated: timestamp('updated', { withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
});

export const ProfileMission = pgTable('profile_missions', {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    guid: text('guid').notNull(),
    token: text('token').notNull(),
    created: timestamp('created', { withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    updated: timestamp('updated', { withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
});

export const Overlay = pgTable('overlays', {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    created: timestamp('created', { withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    updated: timestamp('updated', { withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    type: text('type').notNull().default('vector'),
    styles: json('styles'),
    url: text('url').notNull()
});

export const ProfileOverlay = pgTable('profile_overlays', {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    username: text('username').notNull().references(() => Profile.username),
    created: timestamp('created', { withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    updated: timestamp('updated', { withTimezone: true, mode: 'string' }).notNull().default(sql`Now()`),
    pos: integer('pos').notNull().default(5),
    type: text('type').notNull().default('vector'),
    opacity: numeric('opacity').notNull().default('1'),
    visible: boolean('visible').notNull().default(true),
    token: text('token'),
    styles: json('styles'),
    mode: text('mode').notNull(),
    mode_id: text('mode_id'), // Used for Data not for Profile
    url: text('url').notNull()
}, (t) => ({
    unq: unique().on(t.username, t.url)
}));

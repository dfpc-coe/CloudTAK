import { sql } from 'drizzle-orm';
import { StyleContainer } from './style.js';
import { geometry, GeometryType } from '@openaddresses/batch-generic';

import {
    json,
    boolean,
    integer,
    timestamp,
    pgTable,
    serial,
    varchar,
    text,
    unique
} from 'drizzle-orm/pg-core';

/** Internal Tables for Postgis for use with drizzle-kit push:pg */
export const SpatialRefSys = pgTable('spatial_ref_sys', {
    srid: integer('srid').primaryKey(),
    auth_name: varchar('auth_name', { length: 256 }),
    auth_srid: integer('auth_srid'),
    srtext: varchar('srtext', { length: 2048 }),
    proj4text: varchar('proj4text', { length: 2048 })
});

/** ==== END ==== */

export const Basemap = pgTable('basemaps', {
    id: serial('id').primaryKey(),
    created: timestamp('created', { withTimezone: true }).notNull().default(sql`Now()`),
    updated: timestamp('updated', { withTimezone: true }).notNull().default(sql`Now()`),
    name: text('name').notNull(),
    url: text('url').notNull(),
    bounds: geometry('bounds', { type: GeometryType.Polygon, srid: 4326 }),
    center: geometry('center', { type: GeometryType.Point, srid: 4326 }),
    minzoom: integer('minzoom').notNull().default(0),
    maxzoom: integer('maxzoom').notNull().default(16),
    format: text('format').notNull().default('png'),
    type: text('type').notNull().default('raster')
});

export const Profile = pgTable('profile', {
    username: text('username').primaryKey(),
    auth: json('auth').$type<{
        cert: string;
        key: string;
    }>().notNull(),
    created: timestamp('created', { withTimezone: true }).notNull().default(sql`Now()`),
    updated: timestamp('updated', { withTimezone: true }).notNull().default(sql`Now()`),
    tak_callsign: text('tak_callsign').notNull().default('CloudTAK User'),
    tak_group: text('tak_group').notNull().default('Orange'),
    tak_role: text('tak_role').notNull().default('Team Member'),
    tak_loc: geometry('tak_loc', { srid: 4326, type: GeometryType.Point })
});

export const ProfileSubscription = pgTable('profile_subscriptions', {
    username: text('username').primaryKey(),
    created: timestamp('created', { withTimezone: true }).notNull().default(sql`Now()`),
    updated: timestamp('updated', { withTimezone: true }).notNull().default(sql`Now()`),
    mission: text('mission').notNull()
});

export const ProfileChat = pgTable('profile_chats', {
    username: text('username').primaryKey(),
    chatroom: text('chatroom').notNull(),
    sender_callsign: text('sender_callsign').notNull(),
    sender_uid: text('sender_uid').notNull(),
    created: timestamp('created', { withTimezone: true }).notNull().default(sql`Now()`),
    updated: timestamp('updated', { withTimezone: true }).notNull().default(sql`Now()`),
    message_id: text('message_id').notNull(),
    message: text('message').notNull()
});

export const Import = pgTable('imports', {
    id: text('id').primaryKey(),
    created: timestamp('created', { withTimezone: true }).notNull().default(sql`Now()`),
    updated: timestamp('updated', { withTimezone: true }).notNull().default(sql`Now()`),
    name: text('name').notNull(),
    status: text('status').notNull().default('Pending'),
    error: text('error'),
    result: json('result').notNull().default({}),
    username: text('username').notNull().references(() => Profile.username),
    mode: text('mode').notNull().default('Unknown'),
    mode_id: text('mode_id'),
    config: json('config').notNull().default({})
});

export const Iconset = pgTable('iconsets', {
    uid: text('uid').primaryKey(),
    created: timestamp('created', { withTimezone: true }).notNull().default(sql`Now()`),
    updated: timestamp('updated', { withTimezone: true }).notNull().default(sql`Now()`),
    version: integer('version').notNull(),
    name: text('name').notNull(),
    default_group: text('default_group'),
    default_friendly: text('default_friendly'),
    default_hostile: text('default_hostile'),
    default_neutral: text('default_neutral'),
    default_unknown: text('default_unknown'),
    skip_resize: boolean('skip_resize').notNull().default(false)
});

export const Icon = pgTable('icons', {
    id: serial('id').primaryKey(),
    created: timestamp('created', { withTimezone: true }).notNull().default(sql`Now()`),
    updated: timestamp('updated', { withTimezone: true }).notNull().default(sql`Now()`),
    name: text('name').notNull(),
    iconset: text('iconset').notNull().references(() => Iconset.uid),
    type2525b: text('type2525b'),
    data: text('data').notNull(),
    path: text('path').notNull()
});

export const Connection = pgTable('connections', {
    id: serial('id').primaryKey(),
    created: timestamp('created', { withTimezone: true }).notNull().default(sql`Now()`),
    updated: timestamp('updated', { withTimezone: true }).notNull().default(sql`Now()`),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    enabled: boolean('enabled').notNull().default(true),
    auth: json('auth').$type<{
        cert: string;
        key: string;
    }>().notNull()
});

export const ConnectionSink = pgTable('connection_sinks', {
    id: serial('id').primaryKey(),
    created: timestamp('created', { withTimezone: true }).notNull().default(sql`Now()`),
    updated: timestamp('updated', { withTimezone: true }).notNull().default(sql`Now()`),
    name: text('name').notNull(),
    enabled: boolean('enabled').notNull().default(true),
    connection: integer('connection').notNull().references(() => Connection.id),
    type: text('type').notNull(),
    body: json('body').notNull().default({}),
    logging: boolean('logging').notNull().default(false)
});

export const Data = pgTable('data', {
    id: serial('id').primaryKey(),
    created: timestamp('created', { withTimezone: true }).notNull().default(sql`Now()`),
    updated: timestamp('updated', { withTimezone: true }).notNull().default(sql`Now()`),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    auto_transform: boolean('auto_transform').notNull().default(false),
    mission_sync: boolean('mission_sync').notNull().default(false),
    mission_groups: text('mission_groups').array().notNull().default([]),
    assets: json('assets').$type<Array<string>>().notNull().default(["*"]),
    connection: integer('connection').notNull().references(() => Connection.id)
});

export const Layer = pgTable('layers', {
    id: serial('id').primaryKey(),
    created: timestamp('created', { withTimezone: true }).notNull().default(sql`Now()`),
    updated: timestamp('updated', { withTimezone: true }).notNull().default(sql`Now()`),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    enabled: boolean('enabled').notNull().default(true),
    enabled_styles: boolean('enabled_styles').notNull().default(false),
    styles: json('styles').$type<StyleContainer>().notNull().default({}),
    logging: boolean('logging').notNull().default(true),
    stale: integer('stale').notNull().default(20000),
    task: text('task').notNull(),
    connection: integer('connection').notNull().references(() => Connection.id),
    cron: text('cron'),
    environment: json('environment').notNull().default({}),
    memory: integer('memory').notNull().default(128),
    timeout: integer('timeout').notNull().default(128),
    data: integer('data').notNull().references(() => Data.id),
    schema: json('schema').notNull().default({})
});

export const LayerAlert = pgTable('layer_alerts', {
    id: serial('id').primaryKey(),
    created: timestamp('created', { withTimezone: true }).notNull().default(sql`Now()`),
    updated: timestamp('updated', { withTimezone: true }).notNull().default(sql`Now()`),
    layer: integer('layer').notNull().references(() => Layer.id),
    icon: text('icon').notNull().default('alert-circle'),
    priority: text('priority').notNull().default('yellow'),
    title: text('title').notNull(),
    description: text('description').notNull().default('Details Unknown'),
    hidden: boolean('hidden').notNull().default(false)
});

export const Server = pgTable('server', {
    id: serial('id').primaryKey(),
    created: timestamp('created', { withTimezone: true }).notNull().default(sql`Now()`),
    updated: timestamp('updated', { withTimezone: true }).notNull().default(sql`Now()`),
    name: text('name').notNull().default('Default'),
    url: text('url').notNull(),
    auth: json('auth').$type<{
        cert?: string;
        key?: string;
    }>().notNull().default({}),
    api: text('api').notNull().default(''),
});

export const Token = pgTable('tokens', {
    id: serial('id').notNull(),
    email: text('email').notNull(),
    name: text('name').notNull(),
    token: text('token').primaryKey(),
    created: timestamp('created', { withTimezone: true }).notNull().default(sql`Now()`),
    updated: timestamp('updated', { withTimezone: true }).notNull().default(sql`Now()`),
});

export const ConnectionToken = pgTable('connection_tokens', {
    id: serial('id').notNull(),
    connection: integer('connection').notNull().references(() => Connection.id),
    name: text('name').notNull(),
    token: text('token').primaryKey(),
    created: timestamp('created', { withTimezone: true }).notNull().default(sql`Now()`),
    updated: timestamp('updated', { withTimezone: true }).notNull().default(sql`Now()`),
});

export const ProfileOverlay = pgTable('profile_overlays', {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    username: text('username').notNull().references(() => Profile.username),
    created: timestamp('created', { withTimezone: true }).notNull().default(sql`Now()`),
    updated: timestamp('updated', { withTimezone: true }).notNull().default(sql`Now()`),
    pos: integer('pos').notNull().default(5),
    type: text('type').notNull().default('vector'),
    opacity: integer('opacity').notNull().default(1),
    visible: boolean('visible').notNull().default(true),
    mode: text('mode').notNull(),
    mode_id: integer('mode_id'), // Used for Data not for Profile
    url: text('url').notNull()
}, (t) => ({
    unq: unique().on(t.username, t.url)
}));

import { sql } from 'drizzle-orm';
import {
    json,
    jsonb,
    bigint,
    boolean,
    integer,
    timestamp,
    pgTable,
    serial,
    uniqueIndex,
    varchar
} from 'drizzle-orm/pg-core';

export const Basemap; = pgTable('basemaps', {
    id: serial('id').primaryKey(),
    created: timestamp('created').notNull().default(sql`Now()`),
    updated: timestamp('updated').notNull().default(sql`Now()`),
    name: varchar('name').notNull(),
    url: varchar('url').notNull(),
    //TODO bounds 
    // TODO center
    minzoom: integer('minzoom').notNull().default(0),
    maxzoom: integer('maxzoom').notNull().default(16),
    format: varchar('format').notNull().default('png'),
    type: varchar('type').notNull().default('raster')
});

export const Import = pgTable('imports', {
    id: serial('id').primaryKey(),
    created: timestamp('created').notNull().default(sql`Now()`),
    updated: timestamp('updated').notNull().default(sql`Now()`),
    name: varchar('name').notNull(),
    status: varchar('status').notNull().default('Pending'),
    error: varchar('error'),
    result: json('result').notNull().default(`'{}'::JSON`),
    username: varchar('username').notNull().references(() => Profile.username),
    mode: varchar('mode').notNull().default('Unknown'),
    mode_id: varchar('mode_id'),
    config: json('config').notNull().default(`'{}'::JSON`)
});

export const Iconset = pgTable('iconsets', {
    uid: varchar('uid').primaryKey(),
    created: timestamp('created').notNull().default(sql`Now()`),
    updated: timestamp('updated').notNull().default(sql`Now()`),
    version: integer('version').notNull(),
    name: varchar('name').notNull(),
    default_group: varchar('default_group'),
    default_friendly: varchar('default_friendly'),
    default_hostile: varchar('default_hostile'),
    default_neutral: varchar('default_neutral'),
    default_unknown: varchar('default_unknown'),
    skip_resize: boolean('skip_resize').notNull().default(false)
});

export const Icon = pgTable('icons', {
    id: serial('id').primaryKey(),
    created: timestamp('created').notNull().default(sql`Now()`),
    updated: timestamp('updated').notNull().default(sql`Now()`),
    name: varchar('name').notNull(),
    iconset: varchar('iconset').notNull().references(() => Iconset.uid),
    type2525b: varchar('type2525b'),
    data: varchar('data').notNull(),
    path: varchar('path').notNull()
});

export const Connection = pgTable('connections', {
    id: serial('id').primaryKey(),
    created: timestamp('created').notNull().default(sql`Now()`),
    updated: timestamp('updated').notNull().default(sql`Now()`),
    name: varchar('name').notNull(),
    description: varchar('description').notNull().default(''),
    enabled: boolean('enabled').notNull().default(true),
    auth: json('auth').notNull().default(sql`'{}'::JSON`),
});

export const ConnectionSink = pgTable('connection_sinks', {
    id: serial('id').primaryKey(),
    created: timestamp('created').notNull().default(sql`Now()`),
    updated: timestamp('updated').notNull().default(sql`Now()`),
    name: varchar('name').notNull(),
    enabled: boolean('enabled').notNull().default(true),
    connection: bigint('connection', {
        mode: 'number'
    }).notNull().references(() => Connection.id),
    type: varchar('name').notNull(),
    body: json('body').notNull().default(sql`'{}'::JSON`),
    logging: boolean('logging').notNull().default(false)
});

export const Data = pgTable('data', {
    id: serial('id').primaryKey(),
    created: timestamp('created').notNull().default(sql`Now()`),
    updated: timestamp('updated').notNull().default(sql`Now()`),
    name: varchar('name').notNull(),
    description: varchar('description').notNull().default(''),
    auto_transform: boolean('auto_transform').notNull().default(false),
    connection: bigint('connection', {
        mode: 'number'
    }).notNull().references(() => Connection.id)
});

export const DataMission = pgTable('data_mission', {
    id: serial('id').primaryKey(),
    mission: varchar('mission').notNull(),
    enabled: boolean('enabled').notNull().default(true),
    data: bigint('data', {
        mode: 'number'
    }).notNull().references(() => Data.id),
    assets: json('assets').notNull().default(sql`'["*"]'::JSON`)
});

export const Layer = pgTable('layers', {
    id: serial('id').primaryKey(),
    created: timestamp('created').notNull().default(sql`Now()`),
    updated: timestamp('updated').notNull().default(sql`Now()`),
    name: varchar('name').notNull(),
    description: varchar('description').notNull().default(''),
    enabled: boolean('enabled').notNull().default(true),
    enabled_styles: boolean('enabled_styles').notNull().default(false),
    styles: jsonb('styles').notNull().default(sql`'{}'::JSONB`),
    logging: boolean('logging').notNull().default(true),
    stale: integer('stale').notNull().default(20000),
    task: varchar('task').notNull(),
    connection: bigint('connection', {
        mode: 'number'
    }).notNull().references(() => Connection.id),
    cron: varchar('cron'),
    environment: jsonb('styles').notNull().default(sql`'{}'::JSONB`),
    memory: integer('memory').notNull().default(128),
    timeout: integer('timeout').notNull().default(128),
    data: bigint('data', {
        mode: 'number'
    }).notNull().references(() => Data.id),
    schema: jsonb('schema').notNull().default(sql`'{}'::JSONB`)
});

export const LayerAlert = pgTable('layer_alerts', {
    id: serial('id').primaryKey(),
    created: timestamp('created').notNull().default(sql`Now()`),
    updated: timestamp('updated').notNull().default(sql`Now()`),
    layer: bigint('layer', {
        mode: 'number'
    }).notNull().references(() => Layer.id),
    icon: varchar('icon').notNull().default('alert-circle'),
    priority: varchar('priority').notNull().default('yellow'),
    title: varchar('title').notNull(),
    description: varchar('description').notNull().default('Details Unknown'),
    hidden: boolean('hidden').notNull().default(false)
});

export const Server = pgTable('servers', {
    id: serial('id').primaryKey(),
    created: timestamp('created').notNull().default(sql`Now()`),
    updated: timestamp('updated').notNull().default(sql`Now()`),
    name: varchar('name').notNull().default('Default'),
    url: varchar('url').notNull(),
    auth: json('auth').notNull().default(sql`'{}'::JSON`),
    api: varchar('api').notNull().default(''),
});

export const Token = pgTable('tokens', {
    id: serial('id').primaryKey(),
    email: varchar('email').notNull(),
    name: varchar('name').notNull(),
    token: varchar('token').notNull(),
    created: timestamp('created').notNull().default(sql`Now()`),
    updated: timestamp('updated').notNull().default(sql`Now()`),
});

export const Profile = pgTable('profile', {
    username: varchar('username').primaryKey(),
    auth: json('auth').notNull().default(sql`'{}'::JSON`),
    created: timestamp('created').notNull().default(sql`Now()`),
    updated: timestamp('updated').notNull().default(sql`Now()`),
    tak_callsign: varchar('tak_callsign').notNull().default('CloudTAK User'),
    tak_group: varchar('tak_group').notNull().default('Orange'),
    tak_role: varchar('tak_role').notNull().default('Team Member'),
    // tak_loc TODO ADD GEOMETRY
});

export const ProfileOverlay = pgTable('profile_overlays', {
    id: serial('id').primaryKey(),
    name: varchar('name').notNull(),
    username: varchar('username').notNull().references(() => Profile.username),
    created: timestamp('created').notNull().default(sql`Now()`),
    updated: timestamp('updated').notNull().default(sql`Now()`),
    pos: integer('pos').notNull().default(5),
    type: varchar('type').notNull().default('vector'),
    opacity: integer('opacity').notNull().default(1),
    visible: boolean('visible').notNull().default(true),
    mode: varchar('mode').notNull(),
    mode_id: integer('mode_id').notNull(),
    url: varchar('url').notNull()
});

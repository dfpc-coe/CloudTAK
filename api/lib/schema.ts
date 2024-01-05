import { sql } from 'drizzle-orm';
import {
    json,
    integer,
    boolean,
    timestamp,
    pgTable,
    serial,
    uniqueIndex,
    varchar
} from 'drizzle-orm/pg-core';

/*
export const Basemap; = pgTable('basemaps');
export const ConnectionSink = pgTable('connection_sinks');
export const Connection = pgTable('connections');
export const Data = pgTable('data');
export const DataMission = pgTable('data_mission');
export const Icon = pgTable('icons');
export const Iconset = pgTable('iconsets');
export const Import = pgTable('imports');
export const LayerAlert = pgTable('layer_alerts');
export const Layer = pgTable('layers');
export const Server = pgTable('servers');
*/

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
    username: varchar('name').notNull().references(() => Profile.username),
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

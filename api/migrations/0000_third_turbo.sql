CREATE EXTENSION IF NOT EXISTS POSTGIS;
DROP TABLE IF EXISTS knex_migrations;
DROP TABLE IF EXISTS knex_migrations_lock;

CREATE TABLE IF NOT EXISTS "basemaps" (
	"id" serial PRIMARY KEY NOT NULL,
	"created" timestamp with time zone DEFAULT Now() NOT NULL,
	"updated" timestamp with time zone DEFAULT Now() NOT NULL,
	"name" varchar NOT NULL,
	"url" varchar NOT NULL,
	"bounds" GEOMETRY(POLYGON, 4326),
	"center" GEOMETRY(POINT, 4326),
	"minzoom" integer DEFAULT 0 NOT NULL,
	"maxzoom" integer DEFAULT 16 NOT NULL,
	"format" varchar DEFAULT 'png' NOT NULL,
	"type" varchar DEFAULT 'raster' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "connections" (
	"id" serial PRIMARY KEY NOT NULL,
	"created" timestamp with time zone DEFAULT Now() NOT NULL,
	"updated" timestamp with time zone DEFAULT Now() NOT NULL,
	"name" varchar NOT NULL,
	"description" varchar DEFAULT '' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"auth" json DEFAULT '{}'::json NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "connection_sinks" (
	"id" serial PRIMARY KEY NOT NULL,
	"created" timestamp with time zone DEFAULT Now() NOT NULL,
	"updated" timestamp with time zone DEFAULT Now() NOT NULL,
	"name" varchar NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"connection" bigint NOT NULL,
	"type" varchar NOT NULL,
	"body" json DEFAULT '{}'::json NOT NULL,
	"logging" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "data" (
	"id" serial PRIMARY KEY NOT NULL,
	"created" timestamp with time zone DEFAULT Now() NOT NULL,
	"updated" timestamp with time zone DEFAULT Now() NOT NULL,
	"name" varchar NOT NULL,
	"description" varchar DEFAULT '' NOT NULL,
	"auto_transform" boolean DEFAULT false NOT NULL,
	"connection" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "data_mission" (
	"id" serial PRIMARY KEY NOT NULL,
	"mission" varchar NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"data" bigint NOT NULL,
	"assets" json DEFAULT '["*"]'::json NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "icons" (
	"id" serial PRIMARY KEY NOT NULL,
	"created" timestamp with time zone DEFAULT Now() NOT NULL,
	"updated" timestamp with time zone DEFAULT Now() NOT NULL,
	"name" varchar NOT NULL,
	"iconset" varchar NOT NULL,
	"type2525b" varchar,
	"data" varchar NOT NULL,
	"path" varchar NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "iconsets" (
	"uid" varchar PRIMARY KEY NOT NULL,
	"created" timestamp with time zone DEFAULT Now() NOT NULL,
	"updated" timestamp with time zone DEFAULT Now() NOT NULL,
	"version" integer NOT NULL,
	"name" varchar NOT NULL,
	"default_group" varchar,
	"default_friendly" varchar,
	"default_hostile" varchar,
	"default_neutral" varchar,
	"default_unknown" varchar,
	"skip_resize" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "imports" (
	"id" varchar PRIMARY KEY NOT NULL,
	"created" timestamp with time zone DEFAULT Now() NOT NULL,
	"updated" timestamp with time zone DEFAULT Now() NOT NULL,
	"name" varchar NOT NULL,
	"status" varchar DEFAULT 'Pending' NOT NULL,
	"error" varchar,
	"result" json DEFAULT '{}'::json NOT NULL,
	"username" varchar NOT NULL,
	"mode" varchar DEFAULT 'Unknown' NOT NULL,
	"mode_id" varchar,
	"config" json DEFAULT '{}'::json NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "layers" (
	"id" serial PRIMARY KEY NOT NULL,
	"created" timestamp with time zone DEFAULT Now() NOT NULL,
	"updated" timestamp with time zone DEFAULT Now() NOT NULL,
	"name" varchar NOT NULL,
	"description" varchar DEFAULT '' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"enabled_styles" boolean DEFAULT false NOT NULL,
	"styles" json DEFAULT '{}'::json NOT NULL,
	"logging" boolean DEFAULT true NOT NULL,
	"stale" integer DEFAULT 20000 NOT NULL,
	"task" varchar NOT NULL,
	"connection" bigint NOT NULL,
	"cron" varchar,
	"environment" json DEFAULT '{}'::json NOT NULL,
	"memory" integer DEFAULT 128 NOT NULL,
	"timeout" integer DEFAULT 128 NOT NULL,
	"data" bigint NOT NULL,
	"schema" json DEFAULT '{}'::json NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "layer_alerts" (
	"id" serial PRIMARY KEY NOT NULL,
	"created" timestamp with time zone DEFAULT Now() NOT NULL,
	"updated" timestamp with time zone DEFAULT Now() NOT NULL,
	"layer" bigint NOT NULL,
	"icon" varchar DEFAULT 'alert-circle' NOT NULL,
	"priority" varchar DEFAULT 'yellow' NOT NULL,
	"title" varchar NOT NULL,
	"description" varchar DEFAULT 'Details Unknown' NOT NULL,
	"hidden" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "profile" (
	"username" varchar PRIMARY KEY NOT NULL,
	"auth" json DEFAULT '{}'::json NOT NULL,
	"created" timestamp with time zone DEFAULT Now() NOT NULL,
	"updated" timestamp with time zone DEFAULT Now() NOT NULL,
	"tak_callsign" varchar DEFAULT 'CloudTAK User' NOT NULL,
	"tak_group" varchar DEFAULT 'Orange' NOT NULL,
	"tak_role" varchar DEFAULT 'Team Member' NOT NULL,
	"tak_loc" GEOMETRY(POINT, 4326)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "profile_overlays" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"username" varchar NOT NULL,
	"created" timestamp with time zone DEFAULT Now() NOT NULL,
	"updated" timestamp with time zone DEFAULT Now() NOT NULL,
	"pos" integer DEFAULT 5 NOT NULL,
	"type" varchar DEFAULT 'vector' NOT NULL,
	"opacity" integer DEFAULT 1 NOT NULL,
	"visible" boolean DEFAULT true NOT NULL,
	"mode" varchar NOT NULL,
	"mode_id" integer NOT NULL,
	"url" varchar NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "server" (
	"id" serial PRIMARY KEY NOT NULL,
	"created" timestamp with time zone DEFAULT Now() NOT NULL,
	"updated" timestamp with time zone DEFAULT Now() NOT NULL,
	"name" varchar DEFAULT 'Default' NOT NULL,
	"url" varchar NOT NULL,
	"auth" json DEFAULT '{}'::json NOT NULL,
	"api" varchar DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar NOT NULL,
	"name" varchar NOT NULL,
	"token" varchar NOT NULL,
	"created" timestamp with time zone DEFAULT Now() NOT NULL,
	"updated" timestamp with time zone DEFAULT Now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "connection_sinks" ADD CONSTRAINT "connection_sinks_connection_connections_id_fk" FOREIGN KEY ("connection") REFERENCES "connections"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "data" ADD CONSTRAINT "data_connection_connections_id_fk" FOREIGN KEY ("connection") REFERENCES "connections"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "data_mission" ADD CONSTRAINT "data_mission_data_data_id_fk" FOREIGN KEY ("data") REFERENCES "data"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "icons" ADD CONSTRAINT "icons_iconset_iconsets_uid_fk" FOREIGN KEY ("iconset") REFERENCES "iconsets"("uid") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "imports" ADD CONSTRAINT "imports_username_profile_username_fk" FOREIGN KEY ("username") REFERENCES "profile"("username") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "layers" ADD CONSTRAINT "layers_connection_connections_id_fk" FOREIGN KEY ("connection") REFERENCES "connections"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "layers" ADD CONSTRAINT "layers_data_data_id_fk" FOREIGN KEY ("data") REFERENCES "data"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "layer_alerts" ADD CONSTRAINT "layer_alerts_layer_layers_id_fk" FOREIGN KEY ("layer") REFERENCES "layers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "profile_overlays" ADD CONSTRAINT "profile_overlays_username_profile_username_fk" FOREIGN KEY ("username") REFERENCES "profile"("username") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

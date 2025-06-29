CREATE EXTENSION IF NOT EXISTS POSTGIS;

CREATE TABLE IF NOT EXISTS "basemaps" (
	"id" serial PRIMARY KEY NOT NULL,
	"created" timestamp with time zone DEFAULT Now() NOT NULL,
	"updated" timestamp with time zone DEFAULT Now() NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"bounds" GEOMETRY(POLYGON, 4326),
	"center" GEOMETRY(POINT, 4326),
	"minzoom" integer DEFAULT 0 NOT NULL,
	"maxzoom" integer DEFAULT 16 NOT NULL,
	"format" text DEFAULT 'png' NOT NULL,
	"type" text DEFAULT 'raster' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "connections" (
	"id" serial PRIMARY KEY NOT NULL,
	"created" timestamp with time zone DEFAULT Now() NOT NULL,
	"updated" timestamp with time zone DEFAULT Now() NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"auth" json DEFAULT '{}'::json NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "connection_sinks" (
	"id" serial PRIMARY KEY NOT NULL,
	"created" timestamp with time zone DEFAULT Now() NOT NULL,
	"updated" timestamp with time zone DEFAULT Now() NOT NULL,
	"name" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"connection" integer NOT NULL,
	"type" text NOT NULL,
	"body" json DEFAULT '{}'::json NOT NULL,
	"logging" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "data" (
	"id" serial PRIMARY KEY NOT NULL,
	"created" timestamp with time zone DEFAULT Now() NOT NULL,
	"updated" timestamp with time zone DEFAULT Now() NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"auto_transform" boolean DEFAULT false NOT NULL,
	"connection" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "data_mission" (
	"id" serial PRIMARY KEY NOT NULL,
	"mission" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"data" integer NOT NULL,
	"assets" json DEFAULT '["*"]'::json NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "icons" (
	"id" serial PRIMARY KEY NOT NULL,
	"created" timestamp with time zone DEFAULT Now() NOT NULL,
	"updated" timestamp with time zone DEFAULT Now() NOT NULL,
	"name" text NOT NULL,
	"iconset" text NOT NULL,
	"type2525b" text,
	"data" text NOT NULL,
	"path" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "iconsets" (
	"uid" text PRIMARY KEY NOT NULL,
	"created" timestamp with time zone DEFAULT Now() NOT NULL,
	"updated" timestamp with time zone DEFAULT Now() NOT NULL,
	"version" integer NOT NULL,
	"name" text NOT NULL,
	"default_group" text,
	"default_friendly" text,
	"default_hostile" text,
	"default_neutral" text,
	"default_unknown" text,
	"skip_resize" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "imports" (
	"id" text PRIMARY KEY NOT NULL,
	"created" timestamp with time zone DEFAULT Now() NOT NULL,
	"updated" timestamp with time zone DEFAULT Now() NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'Pending' NOT NULL,
	"error" text,
	"result" json DEFAULT '{}'::json NOT NULL,
	"username" text NOT NULL,
	"mode" text DEFAULT 'Unknown' NOT NULL,
	"mode_id" text,
	"config" json DEFAULT '{}'::json NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "layers" (
	"id" serial PRIMARY KEY NOT NULL,
	"created" timestamp with time zone DEFAULT Now() NOT NULL,
	"updated" timestamp with time zone DEFAULT Now() NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"enabled_styles" boolean DEFAULT false NOT NULL,
	"styles" json DEFAULT '{}'::json NOT NULL,
	"logging" boolean DEFAULT true NOT NULL,
	"stale" integer DEFAULT 20000 NOT NULL,
	"task" text NOT NULL,
	"connection" integer NOT NULL,
	"cron" text,
	"environment" json DEFAULT '{}'::json NOT NULL,
	"memory" integer DEFAULT 128 NOT NULL,
	"timeout" integer DEFAULT 128 NOT NULL,
	"data" integer NOT NULL,
	"schema" json DEFAULT '{}'::json NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "layer_alerts" (
	"id" serial PRIMARY KEY NOT NULL,
	"created" timestamp with time zone DEFAULT Now() NOT NULL,
	"updated" timestamp with time zone DEFAULT Now() NOT NULL,
	"layer" integer NOT NULL,
	"icon" text DEFAULT 'alert-circle' NOT NULL,
	"priority" text DEFAULT 'yellow' NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT 'Details Unknown' NOT NULL,
	"hidden" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "profile" (
	"username" text PRIMARY KEY NOT NULL,
	"auth" json DEFAULT '{}'::json NOT NULL,
	"created" timestamp with time zone DEFAULT Now() NOT NULL,
	"updated" timestamp with time zone DEFAULT Now() NOT NULL,
	"tak_callsign" text DEFAULT 'CloudTAK User' NOT NULL,
	"tak_group" text DEFAULT 'Orange' NOT NULL,
	"tak_role" text DEFAULT 'Team Member' NOT NULL,
	"tak_loc" GEOMETRY(POINT, 4326)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "profile_overlays" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"username" text NOT NULL,
	"created" timestamp with time zone DEFAULT Now() NOT NULL,
	"updated" timestamp with time zone DEFAULT Now() NOT NULL,
	"pos" integer DEFAULT 5 NOT NULL,
	"type" text DEFAULT 'vector' NOT NULL,
	"opacity" integer DEFAULT 1 NOT NULL,
	"visible" boolean DEFAULT true NOT NULL,
	"mode" text NOT NULL,
	"mode_id" integer NOT NULL,
	"url" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "server" (
	"id" serial PRIMARY KEY NOT NULL,
	"created" timestamp with time zone DEFAULT Now() NOT NULL,
	"updated" timestamp with time zone DEFAULT Now() NOT NULL,
	"name" text DEFAULT 'Default' NOT NULL,
	"url" text NOT NULL,
	"auth" json DEFAULT '{}'::json NOT NULL,
	"api" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"token" text NOT NULL,
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

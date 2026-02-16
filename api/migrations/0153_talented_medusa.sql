CREATE TABLE IF NOT EXISTS "basemaps_raster" (
"id" serial PRIMARY KEY NOT NULL,
"basemap" integer NOT NULL,
CONSTRAINT "basemaps_raster_basemap_unique" UNIQUE("basemap")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "basemaps_terrain" (
"id" serial PRIMARY KEY NOT NULL,
"basemap" integer NOT NULL,
CONSTRAINT "basemaps_terrain_basemap_unique" UNIQUE("basemap")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "basemaps_vector" (
"id" serial PRIMARY KEY NOT NULL,
"basemap" integer NOT NULL,
"styles" json DEFAULT '[]'::json NOT NULL,
"iconset" text,
"snapping_enabled" boolean DEFAULT false NOT NULL,
"title" text DEFAULT 'callsign' NOT NULL,
"snapping_layer" text,
CONSTRAINT "basemaps_vector_basemap_unique" UNIQUE("basemap")
);
--> statement-breakpoint
DO $$
BEGIN
    INSERT INTO "basemaps_raster" ("basemap")
    SELECT "id" FROM "basemaps"
    WHERE "type" NOT IN ('vector', 'raster-dem')
    ON CONFLICT ("basemap") DO NOTHING;
END $$;
--> statement-breakpoint
DO $$
BEGIN
    INSERT INTO "basemaps_terrain" ("basemap")
    SELECT "id" FROM "basemaps"
    WHERE "type" = 'raster-dem'
    ON CONFLICT ("basemap") DO NOTHING;
END $$;
--> statement-breakpoint
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'basemaps' AND column_name = 'styles') THEN
        INSERT INTO "basemaps_vector" ("basemap", "styles", "iconset", "snapping_enabled", "title", "snapping_layer")
        SELECT
            "id",
            COALESCE("styles", '[]'::json),
            "iconset",
            COALESCE("snapping_enabled", false),
            COALESCE("title", 'callsign'),
            "snapping_layer"
        FROM "basemaps"
        WHERE "type" = 'vector'
        ON CONFLICT ("basemap") DO NOTHING;
    END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "basemaps" DROP CONSTRAINT IF EXISTS "basemaps_iconset_iconsets_uid_fk";
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "basemaps_raster" ADD CONSTRAINT "basemaps_raster_basemap_basemaps_id_fk" FOREIGN KEY ("basemap") REFERENCES "public"."basemaps"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "basemaps_terrain" ADD CONSTRAINT "basemaps_terrain_basemap_basemaps_id_fk" FOREIGN KEY ("basemap") REFERENCES "public"."basemaps"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "basemaps_vector" ADD CONSTRAINT "basemaps_vector_basemap_basemaps_id_fk" FOREIGN KEY ("basemap") REFERENCES "public"."basemaps"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "basemaps_vector" ADD CONSTRAINT "basemaps_vector_iconset_iconsets_uid_fk" FOREIGN KEY ("iconset") REFERENCES "public"."iconsets"("uid") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "basemaps" DROP COLUMN IF EXISTS "snapping_enabled";--> statement-breakpoint
ALTER TABLE "basemaps" DROP COLUMN IF EXISTS "snapping_layer";--> statement-breakpoint
ALTER TABLE "basemaps" DROP COLUMN IF EXISTS "title";--> statement-breakpoint
ALTER TABLE "basemaps" DROP COLUMN IF EXISTS "iconset";--> statement-breakpoint
ALTER TABLE "basemaps" DROP COLUMN IF EXISTS "styles";

CREATE TABLE "basemaps_raster" (
	"id" serial PRIMARY KEY NOT NULL,
	"basemap" integer NOT NULL,
	CONSTRAINT "basemaps_raster_basemap_unique" UNIQUE("basemap")
);
--> statement-breakpoint
CREATE TABLE "basemaps_terrain" (
	"id" serial PRIMARY KEY NOT NULL,
	"basemap" integer NOT NULL,
	CONSTRAINT "basemaps_terrain_basemap_unique" UNIQUE("basemap")
);
--> statement-breakpoint
CREATE TABLE "basemaps_vector" (
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
ALTER TABLE "basemaps" DROP CONSTRAINT "basemaps_iconset_iconsets_uid_fk";
--> statement-breakpoint
ALTER TABLE "basemaps_raster" ADD CONSTRAINT "basemaps_raster_basemap_basemaps_id_fk" FOREIGN KEY ("basemap") REFERENCES "public"."basemaps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "basemaps_terrain" ADD CONSTRAINT "basemaps_terrain_basemap_basemaps_id_fk" FOREIGN KEY ("basemap") REFERENCES "public"."basemaps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "basemaps_vector" ADD CONSTRAINT "basemaps_vector_basemap_basemaps_id_fk" FOREIGN KEY ("basemap") REFERENCES "public"."basemaps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "basemaps_vector" ADD CONSTRAINT "basemaps_vector_iconset_iconsets_uid_fk" FOREIGN KEY ("iconset") REFERENCES "public"."iconsets"("uid") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "basemaps" DROP COLUMN "snapping_enabled";--> statement-breakpoint
ALTER TABLE "basemaps" DROP COLUMN "snapping_layer";--> statement-breakpoint
ALTER TABLE "basemaps" DROP COLUMN "title";--> statement-breakpoint
ALTER TABLE "basemaps" DROP COLUMN "iconset";--> statement-breakpoint
ALTER TABLE "basemaps" DROP COLUMN "styles";
ALTER TABLE "basemaps_terrain" ADD COLUMN IF NOT EXISTS "encoding" text DEFAULT 'mapbox' NOT NULL;

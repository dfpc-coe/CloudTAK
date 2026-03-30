ALTER TABLE "basemaps" ADD COLUMN IF NOT EXISTS "protocol" text DEFAULT 'zxy' NOT NULL;

UPDATE "basemaps" SET "protocol" = 'featureserver' WHERE url ~ '\/FeatureServer\/[0-9]+$';
UPDATE "basemaps" SET "protocol" = 'mapserver'     WHERE url ~ '\/MapServer\/[0-9]+$';
UPDATE "basemaps" SET "protocol" = 'imageserver'   WHERE url ~ '\/ImageServer$';
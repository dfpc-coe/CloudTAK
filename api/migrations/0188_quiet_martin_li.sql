ALTER TABLE "basemaps" ALTER COLUMN "center" SET DATA TYPE double precision[] USING CASE WHEN "center" IS NULL THEN NULL ELSE ARRAY[ST_X("center"), ST_Y("center")] END;

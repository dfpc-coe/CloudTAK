DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'basemaps' AND column_name = 'center' AND udt_name = 'geometry') THEN
        ALTER TABLE "basemaps" ALTER COLUMN "center" SET DATA TYPE double precision[] USING CASE WHEN "center" IS NULL THEN NULL ELSE ARRAY[ST_X("center"), ST_Y("center")] END;
    END IF;
END $$;

ALTER TABLE "basemaps" ADD COLUMN IF NOT EXISTS "parent" integer;--> statement-breakpoint
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'basemaps_parent_basemaps_id_fk') THEN
        ALTER TABLE "basemaps" ADD CONSTRAINT "basemaps_parent_basemaps_id_fk" FOREIGN KEY ("parent") REFERENCES "public"."basemaps"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
END $$;
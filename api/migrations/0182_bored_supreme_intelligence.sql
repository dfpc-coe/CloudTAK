-- Add the new template column (nullable initially so existing rows can be backfilled)
ALTER TABLE "palette_feature" ADD COLUMN IF NOT EXISTS "template" uuid;--> statement-breakpoint
-- Backfill template from the palette container each feature currently belongs to, if the old table/column are still around
DO $$
BEGIN
    IF to_regclass('public.palette') IS NOT NULL
        AND EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'palette_feature' AND column_name = 'palette'
        )
    THEN
        UPDATE "palette_feature" AS "pf" SET "template" = "p"."template" FROM "palette" AS "p" WHERE "pf"."palette" = "p"."uuid" AND "pf"."template" IS NULL;
    END IF;
END $$;--> statement-breakpoint
-- Now that data is migrated, enforce the NOT NULL constraint
ALTER TABLE "palette_feature" ALTER COLUMN "template" SET NOT NULL;--> statement-breakpoint
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'palette_feature_template_mission_template_id_fk') THEN
        ALTER TABLE "palette_feature" ADD CONSTRAINT "palette_feature_template_mission_template_id_fk" FOREIGN KEY ("template") REFERENCES "public"."mission_template"("id") ON DELETE no action ON UPDATE no action;
    END IF;
END $$;--> statement-breakpoint
-- Drop the old palette container relationship
ALTER TABLE "palette_feature" DROP CONSTRAINT IF EXISTS "palette_feature_palette_palette_uuid_fk";--> statement-breakpoint
ALTER TABLE "palette_feature" DROP COLUMN IF EXISTS "palette";--> statement-breakpoint
-- Remove the now-unused palette container table
DO $$
BEGIN
    IF to_regclass('public.palette') IS NOT NULL THEN
        ALTER TABLE "palette" DISABLE ROW LEVEL SECURITY;
    END IF;
END $$;--> statement-breakpoint
DROP TABLE IF EXISTS "palette" CASCADE;--> statement-breakpoint
ALTER TABLE "connection_features" ALTER COLUMN "properties" SET DEFAULT '{}'::JSONB;--> statement-breakpoint
ALTER TABLE "profile_features" ALTER COLUMN "properties" SET DEFAULT '{}'::JSONB;
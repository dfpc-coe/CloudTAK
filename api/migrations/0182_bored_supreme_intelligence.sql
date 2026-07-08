-- Add the new template column (nullable initially so existing rows can be backfilled)
ALTER TABLE "palette_feature" ADD COLUMN "template" uuid;--> statement-breakpoint
-- Backfill template from the palette container each feature currently belongs to
UPDATE "palette_feature" AS "pf" SET "template" = "p"."template" FROM "palette" AS "p" WHERE "pf"."palette" = "p"."uuid";--> statement-breakpoint
-- Now that data is migrated, enforce the NOT NULL constraint
ALTER TABLE "palette_feature" ALTER COLUMN "template" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "palette_feature" ADD CONSTRAINT "palette_feature_template_mission_template_id_fk" FOREIGN KEY ("template") REFERENCES "public"."mission_template"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Drop the old palette container relationship
ALTER TABLE "palette_feature" DROP CONSTRAINT "palette_feature_palette_palette_uuid_fk";--> statement-breakpoint
ALTER TABLE "palette_feature" DROP COLUMN "palette";--> statement-breakpoint
-- Remove the now-unused palette container table
ALTER TABLE "palette" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "palette" CASCADE;--> statement-breakpoint
ALTER TABLE "connection_features" ALTER COLUMN "properties" SET DEFAULT '{}'::JSONB;--> statement-breakpoint
ALTER TABLE "profile_features" ALTER COLUMN "properties" SET DEFAULT '{}'::JSONB;
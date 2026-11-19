UPDATE "data" SET "name" = trim("name") WHERE "name" <> trim("name");--> statement-breakpoint
ALTER TABLE "basemaps" ADD COLUMN IF NOT EXISTS "args" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "profile_overlays" ADD COLUMN IF NOT EXISTS "args" jsonb DEFAULT '{}'::jsonb NOT NULL;

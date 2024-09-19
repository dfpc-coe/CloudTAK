ALTER TABLE "profile_overlays" ALTER COLUMN "styles" SET DEFAULT '[]'::json;--> statement-breakpoint
ALTER TABLE "profile_overlays" ALTER COLUMN "styles" SET NOT NULL;
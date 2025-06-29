ALTER TABLE "overlays" ALTER COLUMN "styles" SET DEFAULT '[]'::json;--> statement-breakpoint
ALTER TABLE "overlays" ALTER COLUMN "styles" SET NOT NULL;
ALTER TABLE "basemaps" ADD COLUMN IF NOT EXISTS "snapping_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "basemaps" ADD COLUMN IF NOT EXISTS "snapping_layer" text;
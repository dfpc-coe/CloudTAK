ALTER TABLE "basemaps" ADD COLUMN "snapping_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "basemaps" ADD COLUMN "snapping_layer" text;
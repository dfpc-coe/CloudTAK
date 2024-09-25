DROP TABLE "overlays";--> statement-breakpoint
ALTER TABLE "basemaps" ADD COLUMN "overlay" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "basemaps" ADD COLUMN "styles" json DEFAULT '[]'::json NOT NULL;
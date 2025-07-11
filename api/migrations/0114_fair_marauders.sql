ALTER TABLE "basemaps" ADD COLUMN "tilesize" integer DEFAULT 256 NOT NULL;--> statement-breakpoint
ALTER TABLE "basemaps" ADD COLUMN "attribution" text;
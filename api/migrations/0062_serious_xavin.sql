ALTER TABLE "overlays" ADD COLUMN "minzoom" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "overlays" ADD COLUMN "maxzoom" integer DEFAULT 16 NOT NULL;--> statement-breakpoint
ALTER TABLE "overlays" ADD COLUMN "format" text DEFAULT 'png' NOT NULL;--> statement-breakpoint

DELETE FROM overlays;
ALTER TABLE "overlays" ADD CONSTRAINT "overlays_name_unique" UNIQUE("name");

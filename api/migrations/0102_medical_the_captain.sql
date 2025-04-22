ALTER TABLE "basemaps" ADD COLUMN "schema" text DEFAULT 'xyz' NOT NULL;--> statement-breakpoint
ALTER TABLE "basemaps" DROP COLUMN "style";
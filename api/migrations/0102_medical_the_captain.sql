ALTER TABLE "basemaps" ADD COLUMN "scheme" text DEFAULT 'xyz' NOT NULL;--> statement-breakpoint
ALTER TABLE "basemaps" DROP COLUMN "style";

ALTER TABLE "basemaps" DROP CONSTRAINT "basemaps_collection_basemaps_collection_id_fk";
--> statement-breakpoint
ALTER TABLE "basemaps" ALTER COLUMN "collection" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "basemaps_collection" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "basemaps_collection" CASCADE;--> statement-breakpoint

ALTER TABLE "imports" RENAME COLUMN "mode" TO "source";--> statement-breakpoint
ALTER TABLE "imports" RENAME COLUMN "mode_id" TO "source_id";--> statement-breakpoint
ALTER TABLE "imports" DROP COLUMN "batch";

UPDATE "imports" SET source = 'Upload' WHERE source = 'Unknown';

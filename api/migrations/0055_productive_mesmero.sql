ALTER TABLE "imports" ALTER COLUMN "batch" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "imports" ALTER COLUMN "batch" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "imports" ALTER COLUMN "batch" DROP NOT NULL;
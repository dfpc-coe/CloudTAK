ALTER TABLE "layers" ALTER COLUMN "styles" SET DATA TYPE json;--> statement-breakpoint
ALTER TABLE "layers" ALTER COLUMN "styles" SET DEFAULT '{}'::json;--> statement-breakpoint
ALTER TABLE "layers" ALTER COLUMN "schema" SET DATA TYPE json;--> statement-breakpoint
ALTER TABLE "layers" ALTER COLUMN "schema" SET DEFAULT '{}'::json;

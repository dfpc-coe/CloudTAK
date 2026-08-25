UPDATE "layers" SET "permissions" = '{}' WHERE "permissions" IS NULL;--> statement-breakpoint
ALTER TABLE "layers" ALTER COLUMN "permissions" SET DEFAULT '{}';--> statement-breakpoint
ALTER TABLE "layers" ALTER COLUMN "permissions" SET NOT NULL;

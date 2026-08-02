ALTER TABLE "core_event" ALTER COLUMN "mission_guid" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "core_event" ALTER COLUMN "mission_guid" DROP NOT NULL;--> statement-breakpoint
UPDATE "core_event" SET "mission_guid" = NULL;
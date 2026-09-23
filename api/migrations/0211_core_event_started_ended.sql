ALTER TABLE "core_event" ADD COLUMN "started" timestamp with time zone DEFAULT Now() NOT NULL;--> statement-breakpoint
UPDATE "core_event" SET "started" = "created";--> statement-breakpoint
-- active is now derived from ended - an inactive Event without an end time ended when this migration ran
UPDATE "core_event" SET "ended" = Now() WHERE "active" IS FALSE AND "ended" IS NULL;--> statement-breakpoint
ALTER TABLE "core_event" DROP COLUMN "active";
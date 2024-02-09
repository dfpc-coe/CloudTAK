ALTER TABLE data DROP COLUMN mission_groups;
ALTER TABLE "data" ADD COLUMN "mission_groups" text[] NOT NULL DEFAULT '{}'::TEXT[];--> statement-breakpoint

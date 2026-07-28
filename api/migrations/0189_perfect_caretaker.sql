DROP TABLE "core_incident" CASCADE;--> statement-breakpoint
ALTER TABLE "core_event" ADD COLUMN "active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "core_event" ADD COLUMN "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL;
ALTER TABLE "mission_template" ADD COLUMN IF NOT EXISTS "keywords" text;--> statement-breakpoint
ALTER TABLE "mission_template_log" ADD COLUMN IF NOT EXISTS "keywords" text;
ALTER TABLE "mission_template_log" ADD COLUMN IF NOT EXISTS "template" uuid NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "mission_template_log" ADD CONSTRAINT "mission_template_log_template_mission_template_id_fk" FOREIGN KEY ("template") REFERENCES "public"."mission_template"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
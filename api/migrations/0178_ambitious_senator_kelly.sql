ALTER TABLE "errors" ADD COLUMN IF NOT EXISTS "session_id" uuid;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "errors" ADD CONSTRAINT "errors_session_id_profile_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."profile_sessions"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
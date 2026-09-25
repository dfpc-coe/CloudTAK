ALTER TABLE "profile_sessions" ADD COLUMN IF NOT EXISTS "refresh_hash" text;--> statement-breakpoint
ALTER TABLE "profile_sessions" ADD COLUMN IF NOT EXISTS "refresh_previous_hash" text;--> statement-breakpoint
ALTER TABLE "profile_sessions" ADD COLUMN IF NOT EXISTS "refresh_expires" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "profile_sessions" ADD COLUMN IF NOT EXISTS "last_refreshed" timestamp with time zone;--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conrelid = 'public.profile_sessions'::REGCLASS
		AND conname = 'profile_sessions_refresh_hash_unique'
	) THEN
		ALTER TABLE "profile_sessions" ADD CONSTRAINT "profile_sessions_refresh_hash_unique" UNIQUE("refresh_hash");
	END IF;
END $$;

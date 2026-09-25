ALTER TABLE "profile_sessions" ADD COLUMN "refresh_hash" text;--> statement-breakpoint
ALTER TABLE "profile_sessions" ADD COLUMN "refresh_previous_hash" text;--> statement-breakpoint
ALTER TABLE "profile_sessions" ADD COLUMN "refresh_expires" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "profile_sessions" ADD COLUMN "last_refreshed" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "profile_sessions" ADD CONSTRAINT "profile_sessions_refresh_hash_unique" UNIQUE("refresh_hash");
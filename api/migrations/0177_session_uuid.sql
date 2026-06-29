ALTER TABLE "profile_sessions" DROP CONSTRAINT "profile_sessions_pkey";--> statement-breakpoint
ALTER TABLE "profile_sessions" DROP COLUMN "id";--> statement-breakpoint
ALTER TABLE "profile_sessions" ADD COLUMN "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL;

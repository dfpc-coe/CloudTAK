CREATE TABLE IF NOT EXISTS "profile_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"created" timestamp with time zone DEFAULT Now() NOT NULL,
	"ip" text NOT NULL,
	"device_type" text DEFAULT 'Unknown' NOT NULL,
	"browser" text DEFAULT 'Unknown' NOT NULL,
	"os" text DEFAULT 'Unknown' NOT NULL,
	"user_agent" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "profile_sessions" ADD CONSTRAINT "profile_sessions_username_profile_username_fk" FOREIGN KEY ("username") REFERENCES "public"."profile"("username") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
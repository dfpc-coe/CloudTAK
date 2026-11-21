CREATE TABLE IF NOT EXISTS "plugin" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created" timestamp with time zone DEFAULT Now() NOT NULL,
	"updated" timestamp with time zone DEFAULT Now() NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"api_version" integer DEFAULT 1 NOT NULL,
	"version" text,
	"sha256" text,
	"size" integer,
	"username" text
);
--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'plugin_username_profile_username_fk'
			AND conrelid = to_regclass('public.plugin')
	) THEN
		ALTER TABLE "plugin" ADD CONSTRAINT "plugin_username_profile_username_fk" FOREIGN KEY ("username") REFERENCES "public"."profile"("username") ON DELETE set null ON UPDATE no action;
	END IF;
END $$;

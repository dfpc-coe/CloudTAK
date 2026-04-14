CREATE TABLE IF NOT EXISTS "profile_passkeys" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"credential_id" text NOT NULL,
	"public_key" text NOT NULL,
	"counter" integer DEFAULT 0 NOT NULL,
	"transports" jsonb DEFAULT '[]'::jsonb,
	"name" text DEFAULT '' NOT NULL,
	"created" timestamp with time zone DEFAULT Now() NOT NULL,
	"last_used" timestamp with time zone,
	CONSTRAINT "profile_passkeys_credential_id_unique" UNIQUE("credential_id")
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "profile_passkeys" ADD CONSTRAINT "profile_passkeys_username_profile_username_fk" FOREIGN KEY ("username") REFERENCES "public"."profile"("username") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
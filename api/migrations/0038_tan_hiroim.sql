CREATE TABLE IF NOT EXISTS "profile_features" (
	"id" text PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"properties" json DEFAULT '{}'::json NOT NULL,
	"geometry" "GEOMETRY(GEOMETRY, 4326)"
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "profile_features" ADD CONSTRAINT "profile_features_username_profile_username_fk" FOREIGN KEY ("username") REFERENCES "profile"("username") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

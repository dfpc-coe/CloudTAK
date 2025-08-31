CREATE TABLE "profile_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"path" text DEFAULT '/' NOT NULL,
	"name" text NOT NULL,
	"size" integer NOT NULL,
	"artifacts" json DEFAULT '[]'::json NOT NULL
);
--> statement-breakpoint
ALTER TABLE "profile_files" ADD CONSTRAINT "profile_files_username_profile_username_fk" FOREIGN KEY ("username") REFERENCES "public"."profile"("username") ON DELETE no action ON UPDATE no action;
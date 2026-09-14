ALTER TABLE "profile_files" ADD COLUMN IF NOT EXISTS "parent" uuid;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "profile_files" ADD CONSTRAINT "profile_files_parent_profile_files_id_fk" FOREIGN KEY ("parent") REFERENCES "public"."profile_files"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
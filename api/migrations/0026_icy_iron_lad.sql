ALTER TABLE "iconsets" ADD COLUMN "username" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "iconsets" ADD CONSTRAINT "iconsets_username_profile_username_fk" FOREIGN KEY ("username") REFERENCES "profile"("username") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

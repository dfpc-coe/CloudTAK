ALTER TABLE "basemaps" ADD COLUMN IF NOT EXISTS "iconset" text;--> statement-breakpoint
ALTER TABLE "profile_files" ADD COLUMN IF NOT EXISTS "iconset" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "basemaps" ADD CONSTRAINT "basemaps_iconset_iconsets_uid_fk" FOREIGN KEY ("iconset") REFERENCES "public"."iconsets"("uid") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "profile_files" ADD CONSTRAINT "profile_files_iconset_iconsets_uid_fk" FOREIGN KEY ("iconset") REFERENCES "public"."iconsets"("uid") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
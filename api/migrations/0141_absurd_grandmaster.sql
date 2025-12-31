ALTER TABLE "basemaps" ADD COLUMN "iconset" text;--> statement-breakpoint
ALTER TABLE "profile_files" ADD COLUMN "iconset" text;--> statement-breakpoint
ALTER TABLE "basemaps" ADD CONSTRAINT "basemaps_iconset_iconsets_uid_fk" FOREIGN KEY ("iconset") REFERENCES "public"."iconsets"("uid") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_files" ADD CONSTRAINT "profile_files_iconset_iconsets_uid_fk" FOREIGN KEY ("iconset") REFERENCES "public"."iconsets"("uid") ON DELETE no action ON UPDATE no action;
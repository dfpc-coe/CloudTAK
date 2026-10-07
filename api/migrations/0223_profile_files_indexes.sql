CREATE INDEX "profile_files_username_created_idx" ON "profile_files" USING btree ("username","created");--> statement-breakpoint
CREATE INDEX "profile_files_parent_idx" ON "profile_files" USING btree ("parent");--> statement-breakpoint
CREATE INDEX "profile_files_iconset_idx" ON "profile_files" USING btree ("iconset");
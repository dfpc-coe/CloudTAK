ALTER TABLE "layers" ALTER COLUMN "stale" SET DEFAULT 20;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "basemaps_username_idx" ON "basemaps" USING btree ("username");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "iconsets_username_idx" ON "iconsets" USING btree ("username");

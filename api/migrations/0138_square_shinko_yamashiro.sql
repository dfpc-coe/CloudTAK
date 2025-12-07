ALTER TABLE "basemaps" ADD COLUMN "iconset" text;--> statement-breakpoint
ALTER TABLE "iconsets" ADD COLUMN "internal" BOOLEAN NOT NULL DEFAULT False; --> statement-breakpoint
ALTER TABLE "profile_overlays" ADD COLUMN "iconset" text;--> statement-breakpoint
ALTER TABLE "basemaps" ADD CONSTRAINT "basemaps_iconset_iconsets_uid_fk" FOREIGN KEY ("iconset") REFERENCES "public"."iconsets"("uid") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_overlays" ADD CONSTRAINT "profile_overlays_iconset_iconsets_uid_fk" FOREIGN KEY ("iconset") REFERENCES "public"."iconsets"("uid") ON DELETE no action ON UPDATE no action;

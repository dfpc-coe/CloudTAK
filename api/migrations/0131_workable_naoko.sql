ALTER TABLE "basemaps" ADD COLUMN "sharing_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "basemaps" ADD COLUMN "sharing_token" text;
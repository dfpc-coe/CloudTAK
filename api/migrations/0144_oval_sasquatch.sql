CREATE TABLE "basemaps_source" (
	"uuid" uuid DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"url" text NOT NULL,
	"auth" json DEFAULT '{}'::json NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profile_chatroom" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"icon" text NOT NULL,
	"username" text NOT NULL,
	"created" timestamp with time zone DEFAULT Now() NOT NULL,
	"updated" timestamp with time zone DEFAULT Now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "profile_overlays" ADD COLUMN "iconset" text;--> statement-breakpoint
ALTER TABLE "profile_chatroom" ADD CONSTRAINT "profile_chatroom_username_profile_username_fk" FOREIGN KEY ("username") REFERENCES "public"."profile"("username") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_overlays" ADD CONSTRAINT "profile_overlays_iconset_iconsets_uid_fk" FOREIGN KEY ("iconset") REFERENCES "public"."iconsets"("uid") ON DELETE no action ON UPDATE no action;
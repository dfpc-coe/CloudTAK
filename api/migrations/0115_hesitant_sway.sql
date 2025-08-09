CREATE TABLE "profile_videos" (
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"created" timestamp with time zone DEFAULT Now() NOT NULL,
	"updated" timestamp with time zone DEFAULT Now() NOT NULL,
	"url" text NOT NULL,
	"username" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "profile_videos" ADD CONSTRAINT "profile_videos_username_profile_username_fk" FOREIGN KEY ("username") REFERENCES "public"."profile"("username") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "profile_videos_username_idx" ON "profile_videos" USING btree ("username");
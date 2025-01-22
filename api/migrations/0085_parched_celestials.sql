ALTER TABLE "profile_interests" ADD COLUMN "username" text NOT NULL;--> statement-breakpoint
ALTER TABLE "video_lease" ADD COLUMN "read_user" text;--> statement-breakpoint
ALTER TABLE "video_lease" ADD COLUMN "read_pass" text;--> statement-breakpoint
ALTER TABLE "profile_interests" ADD CONSTRAINT "profile_interests_username_profile_username_fk" FOREIGN KEY ("username") REFERENCES "public"."profile"("username") ON DELETE no action ON UPDATE no action;
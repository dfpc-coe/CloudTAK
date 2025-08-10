ALTER TABLE "profile_videos" ADD COLUMN "lease" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "profile_videos" ADD CONSTRAINT "profile_videos_lease_video_lease_id_fk" FOREIGN KEY ("lease") REFERENCES "public"."video_lease"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_videos" DROP COLUMN "url";

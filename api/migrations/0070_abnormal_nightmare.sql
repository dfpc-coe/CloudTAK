ALTER TABLE "video_lease" ALTER COLUMN "ephemeral" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "video_lease" ALTER COLUMN "expiration" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "video_lease" ADD COLUMN "channel" text;

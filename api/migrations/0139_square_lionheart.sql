ALTER TABLE "video_lease" ADD COLUMN "share" boolean DEFAULT false NOT NULL;

UPDATE "video_lease" SET "share" = true WHERE "channel" IS NOT NULL;

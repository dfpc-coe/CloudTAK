ALTER TABLE "profile_chats" ADD COLUMN "read" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "connection_features" DROP COLUMN "deleted";
ALTER TABLE "profile" ALTER COLUMN "auth" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN IF NOT EXISTS "disabled" boolean DEFAULT false NOT NULL;
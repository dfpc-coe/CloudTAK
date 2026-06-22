ALTER TABLE "profile_paging" ADD COLUMN IF NOT EXISTS "seed" text NOT NULL;--> statement-breakpoint
ALTER TABLE "profile_paging" ADD COLUMN IF NOT EXISTS "verified" boolean DEFAULT false NOT NULL;
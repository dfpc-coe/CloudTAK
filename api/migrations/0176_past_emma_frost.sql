ALTER TABLE "profile_paging" ADD COLUMN "seed" text NOT NULL;--> statement-breakpoint
ALTER TABLE "profile_paging" ADD COLUMN "verified" boolean DEFAULT false NOT NULL;
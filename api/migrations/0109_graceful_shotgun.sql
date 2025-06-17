ALTER TABLE "profile_interests" ALTER COLUMN "bounds" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "connections" ADD COLUMN "readonly" boolean DEFAULT false NOT NULL;

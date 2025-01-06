ALTER TABLE "profile" ALTER COLUMN "tak_callsign" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "tak_remarks" text DEFAULT 'CloudTAK User' NOT NULL;
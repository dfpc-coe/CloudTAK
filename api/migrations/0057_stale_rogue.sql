ALTER TABLE "data" ALTER COLUMN "mission_groups" SET DEFAULT '{}';--> statement-breakpoint
ALTER TABLE "profile" ALTER COLUMN "phone" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "profile" ALTER COLUMN "agency_admin" SET NOT NULL;
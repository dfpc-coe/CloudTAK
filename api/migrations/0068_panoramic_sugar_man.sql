ALTER TABLE "settings" ALTER COLUMN "value" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "icons" ADD COLUMN "data_alt" text;--> statement-breakpoint
ALTER TABLE "server" ADD COLUMN "webtak" text DEFAULT '' NOT NULL;
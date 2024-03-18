ALTER TABLE "server" ADD COLUMN "provider_url" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "server" ADD COLUMN "provider_secret" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "server" ADD COLUMN "provider_client" text DEFAULT '' NOT NULL;

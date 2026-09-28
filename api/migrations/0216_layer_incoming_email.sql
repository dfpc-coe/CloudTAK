ALTER TABLE "layers_incoming" ADD COLUMN "email" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "layers_incoming" ADD COLUMN "email_senders" text[] DEFAULT '{}' NOT NULL;
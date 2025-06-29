ALTER TABLE "layers" ADD COLUMN "uuid" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "layers" ADD COLUMN "webhooks" boolean DEFAULT false NOT NULL;
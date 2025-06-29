ALTER TABLE "layers" ALTER COLUMN "cron" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "layers_template" ALTER COLUMN "cron" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "layers_template" ADD COLUMN "webhooks" boolean DEFAULT false NOT NULL;
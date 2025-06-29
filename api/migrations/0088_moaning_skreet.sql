ALTER TABLE "layers" DROP CONSTRAINT "layers_data_data_id_fk";
--> statement-breakpoint
ALTER TABLE "layers_incoming" ADD PRIMARY KEY ("layer");--> statement-breakpoint
ALTER TABLE "layers_incoming" ALTER COLUMN "layer" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "layers_incoming" ADD COLUMN "created" timestamp with time zone DEFAULT Now() NOT NULL;--> statement-breakpoint
ALTER TABLE "layers_incoming" ADD COLUMN "updated" timestamp with time zone DEFAULT Now() NOT NULL;--> statement-breakpoint
ALTER TABLE "layers" DROP COLUMN "cron";--> statement-breakpoint
ALTER TABLE "layers" DROP COLUMN "webhooks";--> statement-breakpoint
ALTER TABLE "layers" DROP COLUMN "alarm_period";--> statement-breakpoint
ALTER TABLE "layers" DROP COLUMN "alarm_evals";--> statement-breakpoint
ALTER TABLE "layers" DROP COLUMN "alarm_points";--> statement-breakpoint
ALTER TABLE "layers" DROP COLUMN "alarm_threshold";--> statement-breakpoint
ALTER TABLE "layers" DROP COLUMN "enabled_styles";--> statement-breakpoint
ALTER TABLE "layers" DROP COLUMN "styles";--> statement-breakpoint
ALTER TABLE "layers" DROP COLUMN "stale";--> statement-breakpoint
ALTER TABLE "layers" DROP COLUMN "environment";--> statement-breakpoint
ALTER TABLE "layers" DROP COLUMN "ephemeral";--> statement-breakpoint
ALTER TABLE "layers" DROP COLUMN "config";--> statement-breakpoint
ALTER TABLE "layers" DROP COLUMN "data";--> statement-breakpoint
ALTER TABLE "layers" DROP COLUMN "schema";
ALTER TABLE "layers" ADD COLUMN "alarm_period" integer DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE "layers" ADD COLUMN "alarm_evals" integer DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE "layers" ADD COLUMN "alarm_points" integer DEFAULT 4 NOT NULL;--> statement-breakpoint
ALTER TABLE "layers" ADD COLUMN "alarm_threshold" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "layers_incoming" DROP COLUMN "alarm_period";--> statement-breakpoint
ALTER TABLE "layers_incoming" DROP COLUMN "alarm_evals";--> statement-breakpoint
ALTER TABLE "layers_incoming" DROP COLUMN "alarm_points";--> statement-breakpoint
ALTER TABLE "layers_incoming" DROP COLUMN "alarm_threshold";
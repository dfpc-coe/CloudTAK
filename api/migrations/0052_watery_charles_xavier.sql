ALTER TABLE "layers_template" ADD COLUMN "alarm_period" integer DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE "layers_template" ADD COLUMN "alarm_evals" integer DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE "layers_template" ADD COLUMN "alarm_points" integer DEFAULT 4 NOT NULL;--> statement-breakpoint
ALTER TABLE "layers_template" ADD COLUMN "alarm_threshold" integer DEFAULT 0 NOT NULL;

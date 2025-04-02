ALTER TABLE "layers_incoming" ADD COLUMN "cron" text;--> statement-breakpoint
ALTER TABLE "layers_incoming" ADD COLUMN "webhooks" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "layers_incoming" ADD COLUMN "alarm_period" integer DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE "layers_incoming" ADD COLUMN "alarm_evals" integer DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE "layers_incoming" ADD COLUMN "alarm_points" integer DEFAULT 4 NOT NULL;--> statement-breakpoint
ALTER TABLE "layers_incoming" ADD COLUMN "alarm_threshold" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "layers_incoming" ADD COLUMN "enabled_styles" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "layers_incoming" ADD COLUMN "styles" json DEFAULT '{}'::json NOT NULL;--> statement-breakpoint
ALTER TABLE "layers_incoming" ADD COLUMN "stale" integer DEFAULT 20 NOT NULL;--> statement-breakpoint
ALTER TABLE "layers_incoming" ADD COLUMN "environment" json DEFAULT '{}'::json NOT NULL;--> statement-breakpoint
ALTER TABLE "layers_incoming" ADD COLUMN "ephemeral" json DEFAULT '{}'::json NOT NULL;--> statement-breakpoint
ALTER TABLE "layers_incoming" ADD COLUMN "config" json DEFAULT '{}'::json NOT NULL;--> statement-breakpoint
ALTER TABLE "layers_incoming" ADD COLUMN "data" integer;--> statement-breakpoint
ALTER TABLE "layers_incoming" ADD COLUMN "schema" json DEFAULT '{"type":"object","required":[],"properties":{}}'::json NOT NULL;--> statement-breakpoint
ALTER TABLE "layers_incoming" ADD CONSTRAINT "layers_incoming_data_data_id_fk" FOREIGN KEY ("data") REFERENCES "public"."data"("id") ON DELETE no action ON UPDATE no action;

INSERT INTO "layers_incoming"
    ("layer", "cron", "webhooks", "alarm_period", "alarm_evals", "alarm_points", "alarm_threshold", "enabled_styles", "styles", "stale", "environment", "ephemeral", "config", "data", "schema")
    SELECT
        id as layer,
        cron,
        webhooks,
        alarm_period,
        alarm_evals,
        alarm_points,
        alarm_threshold,
        enabled_styles,
        styles,
        stale,
        environment,
        ephemeral,
        config,
        data,
        schema
    FROM
        layers;

CREATE TABLE IF NOT EXISTS "layers_template" (
	"id" serial PRIMARY KEY NOT NULL,
	"created" timestamp with time zone DEFAULT Now() NOT NULL,
	"updated" timestamp with time zone DEFAULT Now() NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"username" text NOT NULL,
	"datasync" boolean DEFAULT false NOT NULL,
	"priority" text DEFAULT 'off' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"enabled_styles" boolean DEFAULT false NOT NULL,
	"styles" json DEFAULT '{}'::json NOT NULL,
	"logging" boolean DEFAULT true NOT NULL,
	"stale" integer DEFAULT 20 NOT NULL,
	"task" text NOT NULL,
	"cron" text NOT NULL,
	"config" json DEFAULT '{}'::json NOT NULL,
	"memory" integer DEFAULT 128 NOT NULL,
	"timeout" integer DEFAULT 128 NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "layers_template" ADD CONSTRAINT "layers_template_username_profile_username_fk" FOREIGN KEY ("username") REFERENCES "public"."profile"("username") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

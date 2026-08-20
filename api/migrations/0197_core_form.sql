CREATE TABLE IF NOT EXISTS "core_event_response" (
	"event" uuid NOT NULL,
	"response" uuid NOT NULL,
	CONSTRAINT "core_event_response_event_response_pk" PRIMARY KEY("event","response")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "core_form" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created" timestamp with time zone DEFAULT Now() NOT NULL,
	"updated" timestamp with time zone DEFAULT Now() NOT NULL,
	"username" text,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"schema" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "core_form_channel" (
	"form" uuid NOT NULL,
	"channel" bigint NOT NULL,
	CONSTRAINT "core_form_channel_form_channel_pk" PRIMARY KEY("form","channel")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "core_form_response" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created" timestamp with time zone DEFAULT Now() NOT NULL,
	"updated" timestamp with time zone DEFAULT Now() NOT NULL,
	"form" uuid NOT NULL,
	"username" text,
	"response" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conrelid = 'public.core_event_response'::REGCLASS
		AND conname = 'core_event_response_event_core_event_id_fk'
	) THEN
		ALTER TABLE "core_event_response" ADD CONSTRAINT "core_event_response_event_core_event_id_fk" FOREIGN KEY ("event") REFERENCES "public"."core_event"("id") ON DELETE cascade ON UPDATE no action;
	END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conrelid = 'public.core_event_response'::REGCLASS
		AND conname = 'core_event_response_response_core_form_response_id_fk'
	) THEN
		ALTER TABLE "core_event_response" ADD CONSTRAINT "core_event_response_response_core_form_response_id_fk" FOREIGN KEY ("response") REFERENCES "public"."core_form_response"("id") ON DELETE cascade ON UPDATE no action;
	END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conrelid = 'public.core_form'::REGCLASS
		AND conname = 'core_form_username_profile_username_fk'
	) THEN
		ALTER TABLE "core_form" ADD CONSTRAINT "core_form_username_profile_username_fk" FOREIGN KEY ("username") REFERENCES "public"."profile"("username") ON DELETE no action ON UPDATE no action;
	END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conrelid = 'public.core_form_channel'::REGCLASS
		AND conname = 'core_form_channel_form_core_form_id_fk'
	) THEN
		ALTER TABLE "core_form_channel" ADD CONSTRAINT "core_form_channel_form_core_form_id_fk" FOREIGN KEY ("form") REFERENCES "public"."core_form"("id") ON DELETE cascade ON UPDATE no action;
	END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conrelid = 'public.core_form_response'::REGCLASS
		AND conname = 'core_form_response_form_core_form_id_fk'
	) THEN
		ALTER TABLE "core_form_response" ADD CONSTRAINT "core_form_response_form_core_form_id_fk" FOREIGN KEY ("form") REFERENCES "public"."core_form"("id") ON DELETE cascade ON UPDATE no action;
	END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conrelid = 'public.core_form_response'::REGCLASS
		AND conname = 'core_form_response_username_profile_username_fk'
	) THEN
		ALTER TABLE "core_form_response" ADD CONSTRAINT "core_form_response_username_profile_username_fk" FOREIGN KEY ("username") REFERENCES "public"."profile"("username") ON DELETE no action ON UPDATE no action;
	END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "core_form_response_form_idx" ON "core_form_response" USING btree ("form");

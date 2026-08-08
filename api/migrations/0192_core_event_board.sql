CREATE TABLE IF NOT EXISTS "core_event_board" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created" timestamp with time zone DEFAULT Now() NOT NULL,
	"updated" timestamp with time zone DEFAULT Now() NOT NULL,
	"channel" bigint NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"color" text DEFAULT '' NOT NULL,
	"type" text DEFAULT 'custom' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "core_event_board_event" (
	"id" serial PRIMARY KEY NOT NULL,
	"created" timestamp with time zone DEFAULT Now() NOT NULL,
	"updated" timestamp with time zone DEFAULT Now() NOT NULL,
	"board" uuid NOT NULL,
	"event" uuid NOT NULL,
	"channel" bigint NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "core_event_board_event_channel_event_unique" UNIQUE("channel","event")
);
--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conrelid = 'public.core_event_board_event'::REGCLASS
		AND conname = 'core_event_board_event_board_core_event_board_id_fk'
	) THEN
		ALTER TABLE "core_event_board_event" ADD CONSTRAINT "core_event_board_event_board_core_event_board_id_fk" FOREIGN KEY ("board") REFERENCES "public"."core_event_board"("id") ON DELETE cascade ON UPDATE no action;
	END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conrelid = 'public.core_event_board_event'::REGCLASS
		AND conname = 'core_event_board_event_event_core_event_id_fk'
	) THEN
		ALTER TABLE "core_event_board_event" ADD CONSTRAINT "core_event_board_event_event_core_event_id_fk" FOREIGN KEY ("event") REFERENCES "public"."core_event"("id") ON DELETE cascade ON UPDATE no action;
	END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "core_event_board_channel_idx" ON "core_event_board" USING btree ("channel");

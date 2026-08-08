CREATE TABLE IF NOT EXISTS "core_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created" timestamp with time zone DEFAULT Now() NOT NULL,
	"updated" timestamp with time zone DEFAULT Now() NOT NULL,
	"ended" timestamp with time zone,
	"username" text,
	"priority" text DEFAULT 'none' NOT NULL,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"external_id" text DEFAULT '' NOT NULL,
	"editable" boolean DEFAULT true NOT NULL,
	"location" text DEFAULT '' NOT NULL,
	"remarks" text DEFAULT '' NOT NULL,
	"geometry" GEOMETRY(POINT, 4326) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "core_event_channel" (
	"event" uuid NOT NULL,
	"channel" bigint NOT NULL,
	CONSTRAINT "core_event_channel_event_channel_pk" PRIMARY KEY("event","channel")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "core_event" ADD CONSTRAINT "core_event_username_profile_username_fk" FOREIGN KEY ("username") REFERENCES "public"."profile"("username") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "core_event_channel" ADD CONSTRAINT "core_event_channel_event_core_event_id_fk" FOREIGN KEY ("event") REFERENCES "public"."core_event"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

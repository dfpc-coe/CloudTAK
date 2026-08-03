CREATE TABLE "core_device" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created" timestamp with time zone DEFAULT Now() NOT NULL,
	"updated" timestamp with time zone DEFAULT Now() NOT NULL,
	"username" text,
	"connection" integer,
	"event" uuid,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"external_id" text DEFAULT '' NOT NULL,
	"remarks" text DEFAULT '' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_seen" timestamp with time zone,
	"geometry" GEOMETRY(POINT, 4326)
);
--> statement-breakpoint
CREATE TABLE "core_device_channel" (
	"device" uuid NOT NULL,
	"channel" bigint NOT NULL,
	CONSTRAINT "core_device_channel_device_channel_pk" PRIMARY KEY("device","channel")
);
--> statement-breakpoint
ALTER TABLE "core_device" ADD CONSTRAINT "core_device_username_profile_username_fk" FOREIGN KEY ("username") REFERENCES "public"."profile"("username") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core_device" ADD CONSTRAINT "core_device_connection_connections_id_fk" FOREIGN KEY ("connection") REFERENCES "public"."connections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core_device" ADD CONSTRAINT "core_device_event_core_event_id_fk" FOREIGN KEY ("event") REFERENCES "public"."core_event"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core_device_channel" ADD CONSTRAINT "core_device_channel_device_core_device_id_fk" FOREIGN KEY ("device") REFERENCES "public"."core_device"("id") ON DELETE cascade ON UPDATE no action;

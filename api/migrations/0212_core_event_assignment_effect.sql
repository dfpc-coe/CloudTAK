CREATE TABLE "core_event_assignment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created" timestamp with time zone DEFAULT Now() NOT NULL,
	"updated" timestamp with time zone DEFAULT Now() NOT NULL,
	"event" uuid NOT NULL,
	"uid" text,
	"name" text NOT NULL,
	"role" text DEFAULT '' NOT NULL,
	"remarks" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core_event_effect" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created" timestamp with time zone DEFAULT Now() NOT NULL,
	"updated" timestamp with time zone DEFAULT Now() NOT NULL,
	"started" timestamp with time zone DEFAULT Now() NOT NULL,
	"ended" timestamp with time zone,
	"event" uuid NOT NULL,
	"device" uuid NOT NULL,
	"action" text NOT NULL,
	"status" text DEFAULT 'tasked' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "core_event_assignment" ADD CONSTRAINT "core_event_assignment_event_core_event_id_fk" FOREIGN KEY ("event") REFERENCES "public"."core_event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core_event_assignment" ADD CONSTRAINT "core_event_assignment_uid_profile_username_fk" FOREIGN KEY ("uid") REFERENCES "public"."profile"("username") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core_event_effect" ADD CONSTRAINT "core_event_effect_event_core_event_id_fk" FOREIGN KEY ("event") REFERENCES "public"."core_event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core_event_effect" ADD CONSTRAINT "core_event_effect_device_core_device_id_fk" FOREIGN KEY ("device") REFERENCES "public"."core_device"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "core_event_assignment_event_uid_idx" ON "core_event_assignment" USING btree ("event","uid") WHERE uid IS NOT NULL;
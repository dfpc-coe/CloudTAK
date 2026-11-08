CREATE TABLE "core_entity_timeline" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created" timestamp with time zone DEFAULT Now() NOT NULL,
	"updated" timestamp with time zone DEFAULT Now() NOT NULL,
	"occurred" timestamp with time zone DEFAULT Now() NOT NULL,
	"entity" uuid NOT NULL,
	"type" text DEFAULT 'comment' NOT NULL,
	"username" text,
	"author" text DEFAULT '' NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"external_id" text
);
--> statement-breakpoint
ALTER TABLE "core_entity_timeline" ADD CONSTRAINT "core_entity_timeline_entity_core_entity_id_fk" FOREIGN KEY ("entity") REFERENCES "public"."core_entity"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core_entity_timeline" ADD CONSTRAINT "core_entity_timeline_username_profile_username_fk" FOREIGN KEY ("username") REFERENCES "public"."profile"("username") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "core_entity_timeline_entity_occurred_idx" ON "core_entity_timeline" USING btree ("entity","occurred");--> statement-breakpoint
CREATE UNIQUE INDEX "core_entity_timeline_entity_external_id_idx" ON "core_entity_timeline" USING btree ("entity","external_id") WHERE external_id IS NOT NULL;
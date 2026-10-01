CREATE TABLE IF NOT EXISTS "core_entity_event" (
	"id" uuid PRIMARY KEY NOT NULL,
	"started" timestamp with time zone DEFAULT Now() NOT NULL,
	"ended" timestamp with time zone,
	"priority" text DEFAULT 'none' NOT NULL,
	"location" text DEFAULT '' NOT NULL
);--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'core_entity_event_id_core_entity_id_fk' AND conrelid = to_regclass('public.core_entity_event')
	) THEN
		ALTER TABLE "core_entity_event" ADD CONSTRAINT "core_entity_event_id_core_entity_id_fk" FOREIGN KEY ("id") REFERENCES "public"."core_entity"("id") ON DELETE cascade ON UPDATE no action;
	END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
	IF EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema = 'public' AND table_name = 'core_entity' AND column_name = 'started'
	) THEN
		INSERT INTO "core_entity_event" ("id", "started", "ended", "priority", "location")
		SELECT "id", "started", "ended", "priority", "location" FROM "core_entity" WHERE "kind" = 'CoreEvent'
		ON CONFLICT ("id") DO NOTHING;
	END IF;
END $$;--> statement-breakpoint
ALTER TABLE "core_entity" DROP COLUMN IF EXISTS "started";--> statement-breakpoint
ALTER TABLE "core_entity" DROP COLUMN IF EXISTS "ended";--> statement-breakpoint
ALTER TABLE "core_entity" DROP COLUMN IF EXISTS "priority";--> statement-breakpoint
ALTER TABLE "core_entity" DROP COLUMN IF EXISTS "location";

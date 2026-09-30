ALTER TABLE "core_entity" ADD COLUMN IF NOT EXISTS "kind" text DEFAULT 'CoreEvent' NOT NULL;--> statement-breakpoint
DO $$ BEGIN
	IF EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema = 'public' AND table_name = 'core_entity_channel' AND column_name = 'event'
	) THEN
		ALTER TABLE "core_entity_channel" RENAME COLUMN "event" TO "entity";
	END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
	IF EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'core_entity_channel_event_core_entity_id_fk' AND conrelid = to_regclass('public.core_entity_channel')
	) THEN
		ALTER TABLE "core_entity_channel" RENAME CONSTRAINT "core_entity_channel_event_core_entity_id_fk" TO "core_entity_channel_entity_core_entity_id_fk";
	END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
	IF EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'core_entity_channel_event_channel_pk' AND conrelid = to_regclass('public.core_entity_channel')
	) THEN
		ALTER TABLE "core_entity_channel" RENAME CONSTRAINT "core_entity_channel_event_channel_pk" TO "core_entity_channel_entity_channel_pk";
	END IF;
END $$;

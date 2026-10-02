DO $$ BEGIN
	IF to_regclass('public.core_event') IS NOT NULL AND to_regclass('public.core_entity') IS NULL THEN
		ALTER TABLE "core_event" RENAME TO "core_entity";
	END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
	IF to_regclass('public.core_event_channel') IS NOT NULL AND to_regclass('public.core_entity_channel') IS NULL THEN
		ALTER TABLE "core_event_channel" RENAME TO "core_entity_channel";
	END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
	IF to_regclass('public.core_event_board') IS NOT NULL AND to_regclass('public.core_entity_board') IS NULL THEN
		ALTER TABLE "core_event_board" RENAME TO "core_entity_board";
	END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
	IF to_regclass('public.core_event_board_column') IS NOT NULL AND to_regclass('public.core_entity_board_column') IS NULL THEN
		ALTER TABLE "core_event_board_column" RENAME TO "core_entity_board_column";
	END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
	IF to_regclass('public.core_event_board_event') IS NOT NULL AND to_regclass('public.core_entity_board_event') IS NULL THEN
		ALTER TABLE "core_event_board_event" RENAME TO "core_entity_board_event";
	END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
	IF to_regclass('public.core_event_assignment') IS NOT NULL AND to_regclass('public.core_entity_assignment') IS NULL THEN
		ALTER TABLE "core_event_assignment" RENAME TO "core_entity_assignment";
	END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
	IF to_regclass('public.core_event_effect') IS NOT NULL AND to_regclass('public.core_entity_effect') IS NULL THEN
		ALTER TABLE "core_event_effect" RENAME TO "core_entity_effect";
	END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
	IF to_regclass('public.core_event_response') IS NOT NULL AND to_regclass('public.core_entity_response') IS NULL THEN
		ALTER TABLE "core_event_response" RENAME TO "core_entity_response";
	END IF;
END $$;--> statement-breakpoint
ALTER INDEX IF EXISTS "core_event_connection_external_id_idx" RENAME TO "core_entity_connection_external_id_idx";--> statement-breakpoint
ALTER INDEX IF EXISTS "core_event_board_channel_idx" RENAME TO "core_entity_board_channel_idx";--> statement-breakpoint
ALTER INDEX IF EXISTS "core_event_board_column_board_idx" RENAME TO "core_entity_board_column_board_idx";--> statement-breakpoint
ALTER INDEX IF EXISTS "core_event_assignment_event_uid_idx" RENAME TO "core_entity_assignment_event_uid_idx";--> statement-breakpoint
DO $$ BEGIN
	IF EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'core_event_pkey' AND conrelid = to_regclass('public.core_entity')
	) THEN
		ALTER TABLE "core_entity" RENAME CONSTRAINT "core_event_pkey" TO "core_entity_pkey";
	END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
	IF EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'core_event_username_profile_username_fk' AND conrelid = to_regclass('public.core_entity')
	) THEN
		ALTER TABLE "core_entity" RENAME CONSTRAINT "core_event_username_profile_username_fk" TO "core_entity_username_profile_username_fk";
	END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
	IF EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'core_event_connection_connections_id_fk' AND conrelid = to_regclass('public.core_entity')
	) THEN
		ALTER TABLE "core_entity" RENAME CONSTRAINT "core_event_connection_connections_id_fk" TO "core_entity_connection_connections_id_fk";
	END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
	IF EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'core_event_channel_event_channel_pk' AND conrelid = to_regclass('public.core_entity_channel')
	) THEN
		ALTER TABLE "core_entity_channel" RENAME CONSTRAINT "core_event_channel_event_channel_pk" TO "core_entity_channel_event_channel_pk";
	END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
	IF EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'core_event_channel_event_core_event_id_fk' AND conrelid = to_regclass('public.core_entity_channel')
	) THEN
		ALTER TABLE "core_entity_channel" RENAME CONSTRAINT "core_event_channel_event_core_event_id_fk" TO "core_entity_channel_event_core_entity_id_fk";
	END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
	IF EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'core_event_board_pkey' AND conrelid = to_regclass('public.core_entity_board')
	) THEN
		ALTER TABLE "core_entity_board" RENAME CONSTRAINT "core_event_board_pkey" TO "core_entity_board_pkey";
	END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
	IF EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'core_event_board_column_pkey' AND conrelid = to_regclass('public.core_entity_board_column')
	) THEN
		ALTER TABLE "core_entity_board_column" RENAME CONSTRAINT "core_event_board_column_pkey" TO "core_entity_board_column_pkey";
	END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
	IF EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'core_event_board_column_board_core_event_board_id_fk' AND conrelid = to_regclass('public.core_entity_board_column')
	) THEN
		ALTER TABLE "core_entity_board_column" RENAME CONSTRAINT "core_event_board_column_board_core_event_board_id_fk" TO "core_entity_board_column_board_core_entity_board_id_fk";
	END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
	IF EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'core_event_board_event_pkey' AND conrelid = to_regclass('public.core_entity_board_event')
	) THEN
		ALTER TABLE "core_entity_board_event" RENAME CONSTRAINT "core_event_board_event_pkey" TO "core_entity_board_event_pkey";
	END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
	IF EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'core_event_board_event_board_event_unique' AND conrelid = to_regclass('public.core_entity_board_event')
	) THEN
		ALTER TABLE "core_entity_board_event" RENAME CONSTRAINT "core_event_board_event_board_event_unique" TO "core_entity_board_event_board_event_unique";
	END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
	IF EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'core_event_board_event_board_core_event_board_id_fk' AND conrelid = to_regclass('public.core_entity_board_event')
	) THEN
		ALTER TABLE "core_entity_board_event" RENAME CONSTRAINT "core_event_board_event_board_core_event_board_id_fk" TO "core_entity_board_event_board_core_entity_board_id_fk";
	END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
	IF EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'core_event_board_event_column_core_event_board_column_id_fk' AND conrelid = to_regclass('public.core_entity_board_event')
	) THEN
		ALTER TABLE "core_entity_board_event" RENAME CONSTRAINT "core_event_board_event_column_core_event_board_column_id_fk" TO "core_entity_board_event_column_core_entity_board_column_id_fk";
	END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
	IF EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'core_event_board_event_event_core_event_id_fk' AND conrelid = to_regclass('public.core_entity_board_event')
	) THEN
		ALTER TABLE "core_entity_board_event" RENAME CONSTRAINT "core_event_board_event_event_core_event_id_fk" TO "core_entity_board_event_event_core_entity_id_fk";
	END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
	IF EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'core_event_assignment_pkey' AND conrelid = to_regclass('public.core_entity_assignment')
	) THEN
		ALTER TABLE "core_entity_assignment" RENAME CONSTRAINT "core_event_assignment_pkey" TO "core_entity_assignment_pkey";
	END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
	IF EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'core_event_assignment_event_core_event_id_fk' AND conrelid = to_regclass('public.core_entity_assignment')
	) THEN
		ALTER TABLE "core_entity_assignment" RENAME CONSTRAINT "core_event_assignment_event_core_event_id_fk" TO "core_entity_assignment_event_core_entity_id_fk";
	END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
	IF EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'core_event_assignment_uid_profile_username_fk' AND conrelid = to_regclass('public.core_entity_assignment')
	) THEN
		ALTER TABLE "core_entity_assignment" RENAME CONSTRAINT "core_event_assignment_uid_profile_username_fk" TO "core_entity_assignment_uid_profile_username_fk";
	END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
	IF EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'core_event_effect_pkey' AND conrelid = to_regclass('public.core_entity_effect')
	) THEN
		ALTER TABLE "core_entity_effect" RENAME CONSTRAINT "core_event_effect_pkey" TO "core_entity_effect_pkey";
	END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
	IF EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'core_event_effect_event_core_event_id_fk' AND conrelid = to_regclass('public.core_entity_effect')
	) THEN
		ALTER TABLE "core_entity_effect" RENAME CONSTRAINT "core_event_effect_event_core_event_id_fk" TO "core_entity_effect_event_core_entity_id_fk";
	END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
	IF EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'core_event_effect_device_core_device_id_fk' AND conrelid = to_regclass('public.core_entity_effect')
	) THEN
		ALTER TABLE "core_entity_effect" RENAME CONSTRAINT "core_event_effect_device_core_device_id_fk" TO "core_entity_effect_device_core_device_id_fk";
	END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
	IF EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'core_event_response_event_response_pk' AND conrelid = to_regclass('public.core_entity_response')
	) THEN
		ALTER TABLE "core_entity_response" RENAME CONSTRAINT "core_event_response_event_response_pk" TO "core_entity_response_event_response_pk";
	END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
	IF EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'core_event_response_event_core_event_id_fk' AND conrelid = to_regclass('public.core_entity_response')
	) THEN
		ALTER TABLE "core_entity_response" RENAME CONSTRAINT "core_event_response_event_core_event_id_fk" TO "core_entity_response_event_core_entity_id_fk";
	END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
	IF EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'core_event_response_response_core_form_response_id_fk' AND conrelid = to_regclass('public.core_entity_response')
	) THEN
		ALTER TABLE "core_entity_response" RENAME CONSTRAINT "core_event_response_response_core_form_response_id_fk" TO "core_entity_response_response_core_form_response_id_fk";
	END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
	IF EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'core_device_event_core_event_id_fk' AND conrelid = to_regclass('public.core_device')
	) THEN
		ALTER TABLE "core_device" RENAME CONSTRAINT "core_device_event_core_event_id_fk" TO "core_device_event_core_entity_id_fk";
	END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
	IF EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'core_form_column_column_core_event_board_column_id_fk' AND conrelid = to_regclass('public.core_form_column')
	) THEN
		ALTER TABLE "core_form_column" RENAME CONSTRAINT "core_form_column_column_core_event_board_column_id_fk" TO "core_form_column_column_core_entity_board_column_id_fk";
	END IF;
END $$;

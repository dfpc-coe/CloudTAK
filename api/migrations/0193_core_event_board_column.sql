-- The rows that used to be Boards are the KanBan Columns - rename the table in
-- place so existing placements keep pointing at them, then hang a new Board
-- table above it with one Board per Channel that had Columns
--
-- Every step is guarded so a partially applied run can be repeated: the
-- rename block is the marker for whether the reshape has already happened
DO $$ BEGIN
	IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'core_event_board')
		AND NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'core_event_board_column')
	THEN
		ALTER TABLE "core_event_board" RENAME TO "core_event_board_column";

		-- Index names are unique per schema, so the old primary key and channel
		-- index have to move aside before the new Board table claims them
		IF EXISTS (
			SELECT 1 FROM pg_constraint
			WHERE conrelid = 'public.core_event_board_column'::REGCLASS
			AND conname = 'core_event_board_pkey'
		) THEN
			ALTER TABLE "core_event_board_column" RENAME CONSTRAINT "core_event_board_pkey" TO "core_event_board_column_pkey";
		END IF;

		ALTER INDEX IF EXISTS "core_event_board_channel_idx" RENAME TO "core_event_board_column_channel_idx";
	END IF;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "core_event_board" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created" timestamp with time zone DEFAULT Now() NOT NULL,
	"updated" timestamp with time zone DEFAULT Now() NOT NULL,
	"channel" bigint NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
	IF EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema = 'public' AND table_name = 'core_event_board_column' AND column_name = 'channel'
	) THEN
		INSERT INTO "core_event_board" ("channel", "name")
			SELECT DISTINCT col."channel", 'Events'
			FROM "core_event_board_column" col
			WHERE NOT EXISTS (
				SELECT 1 FROM "core_event_board" brd WHERE brd."channel" = col."channel"
			);
	END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "core_event_board_column" ADD COLUMN IF NOT EXISTS "board" uuid;
--> statement-breakpoint
DO $$ BEGIN
	IF EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema = 'public' AND table_name = 'core_event_board_column' AND column_name = 'channel'
	) THEN
		UPDATE "core_event_board_column" col
			SET "board" = brd."id"
			FROM "core_event_board" brd
			WHERE brd."channel" = col."channel"
			AND col."board" IS NULL;
	END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (SELECT 1 FROM "core_event_board_column" WHERE "board" IS NULL) THEN
		ALTER TABLE "core_event_board_column" ALTER COLUMN "board" SET NOT NULL;
	END IF;
END $$;
--> statement-breakpoint
-- Dropping the Channel takes its index with it, freeing the index name for the
-- new Board table
ALTER TABLE "core_event_board_column" DROP COLUMN IF EXISTS "channel";
--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conrelid = 'public.core_event_board_column'::REGCLASS
		AND conname = 'core_event_board_column_board_core_event_board_id_fk'
	) THEN
		ALTER TABLE "core_event_board_column" ADD CONSTRAINT "core_event_board_column_board_core_event_board_id_fk" FOREIGN KEY ("board") REFERENCES "public"."core_event_board"("id") ON DELETE cascade ON UPDATE no action;
	END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "core_event_board_column_board_idx" ON "core_event_board_column" USING btree ("board");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "core_event_board_channel_idx" ON "core_event_board" USING btree ("channel");
--> statement-breakpoint
-- Existing placements reference what is now a Column - move that reference to
-- the new column and repoint board at the Column's Board
ALTER TABLE "core_event_board_event" DROP CONSTRAINT IF EXISTS "core_event_board_event_board_core_event_board_id_fk";
--> statement-breakpoint
ALTER TABLE "core_event_board_event" ADD COLUMN IF NOT EXISTS "column" uuid;
--> statement-breakpoint
DO $$ BEGIN
	IF EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema = 'public' AND table_name = 'core_event_board_event' AND column_name = 'channel'
	) THEN
		UPDATE "core_event_board_event" SET "column" = "board" WHERE "column" IS NULL;

		UPDATE "core_event_board_event" ev
			SET "board" = col."board"
			FROM "core_event_board_column" col
			WHERE col."id" = ev."column";
	END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (SELECT 1 FROM "core_event_board_event" WHERE "column" IS NULL) THEN
		ALTER TABLE "core_event_board_event" ALTER COLUMN "column" SET NOT NULL;
	END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "core_event_board_event" DROP CONSTRAINT IF EXISTS "core_event_board_event_channel_event_unique";
--> statement-breakpoint
ALTER TABLE "core_event_board_event" DROP COLUMN IF EXISTS "channel";
--> statement-breakpoint
-- Swap the serial primary key for a uuid - keyed off the current type so a
-- repeat run doesn't re-issue every placement id
DO $$ BEGIN
	IF EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema = 'public' AND table_name = 'core_event_board_event'
		AND column_name = 'id' AND data_type <> 'uuid'
	) THEN
		ALTER TABLE "core_event_board_event" DROP COLUMN "id";
		ALTER TABLE "core_event_board_event" ADD COLUMN "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL;
	END IF;
END $$;
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
		AND conname = 'core_event_board_event_column_core_event_board_column_id_fk'
	) THEN
		ALTER TABLE "core_event_board_event" ADD CONSTRAINT "core_event_board_event_column_core_event_board_column_id_fk" FOREIGN KEY ("column") REFERENCES "public"."core_event_board_column"("id") ON DELETE cascade ON UPDATE no action;
	END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conrelid = 'public.core_event_board_event'::REGCLASS
		AND conname = 'core_event_board_event_board_event_unique'
	) THEN
		ALTER TABLE "core_event_board_event" ADD CONSTRAINT "core_event_board_event_board_event_unique" UNIQUE("board","event");
	END IF;
END $$;

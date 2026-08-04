-- The rows that used to be Boards are the KanBan Columns - rename the table in
-- place so existing placements keep pointing at them, then hang a new Board
-- table above it with one Board per Channel that had Columns
ALTER TABLE "core_event_board" RENAME TO "core_event_board_column";--> statement-breakpoint
ALTER TABLE "core_event_board_column" RENAME CONSTRAINT "core_event_board_pkey" TO "core_event_board_column_pkey";--> statement-breakpoint
ALTER INDEX "core_event_board_channel_idx" RENAME TO "core_event_board_column_channel_idx";--> statement-breakpoint
CREATE TABLE "core_event_board" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created" timestamp with time zone DEFAULT Now() NOT NULL,
	"updated" timestamp with time zone DEFAULT Now() NOT NULL,
	"channel" bigint NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL
);--> statement-breakpoint
INSERT INTO "core_event_board" ("channel", "name")
	SELECT DISTINCT "channel", 'Events' FROM "core_event_board_column";--> statement-breakpoint
ALTER TABLE "core_event_board_column" ADD COLUMN "board" uuid;--> statement-breakpoint
UPDATE "core_event_board_column"
	SET "board" = "core_event_board"."id"
	FROM "core_event_board"
	WHERE "core_event_board"."channel" = "core_event_board_column"."channel";--> statement-breakpoint
ALTER TABLE "core_event_board_column" ALTER COLUMN "board" SET NOT NULL;--> statement-breakpoint
-- Dropping the Channel takes its index with it, freeing the index name for the
-- new Board table
ALTER TABLE "core_event_board_column" DROP COLUMN "channel";--> statement-breakpoint
ALTER TABLE "core_event_board_column" ADD CONSTRAINT "core_event_board_column_board_core_event_board_id_fk" FOREIGN KEY ("board") REFERENCES "public"."core_event_board"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "core_event_board_column_board_idx" ON "core_event_board_column" USING btree ("board");--> statement-breakpoint
CREATE INDEX "core_event_board_channel_idx" ON "core_event_board" USING btree ("channel");--> statement-breakpoint
-- Existing placements reference what is now a Column - move that reference to
-- the new column and repoint board at the Column's Board
ALTER TABLE "core_event_board_event" DROP CONSTRAINT "core_event_board_event_board_core_event_board_id_fk";--> statement-breakpoint
ALTER TABLE "core_event_board_event" ADD COLUMN "column" uuid;--> statement-breakpoint
UPDATE "core_event_board_event" SET "column" = "board";--> statement-breakpoint
UPDATE "core_event_board_event"
	SET "board" = "core_event_board_column"."board"
	FROM "core_event_board_column"
	WHERE "core_event_board_column"."id" = "core_event_board_event"."column";--> statement-breakpoint
ALTER TABLE "core_event_board_event" ALTER COLUMN "column" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "core_event_board_event" DROP CONSTRAINT "core_event_board_event_channel_event_unique";--> statement-breakpoint
ALTER TABLE "core_event_board_event" DROP COLUMN "channel";--> statement-breakpoint
ALTER TABLE "core_event_board_event" DROP COLUMN "id";--> statement-breakpoint
ALTER TABLE "core_event_board_event" ADD COLUMN "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "core_event_board_event" ADD CONSTRAINT "core_event_board_event_board_core_event_board_id_fk" FOREIGN KEY ("board") REFERENCES "public"."core_event_board"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core_event_board_event" ADD CONSTRAINT "core_event_board_event_column_core_event_board_column_id_fk" FOREIGN KEY ("column") REFERENCES "public"."core_event_board_column"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core_event_board_event" ADD CONSTRAINT "core_event_board_event_board_event_unique" UNIQUE("board","event");

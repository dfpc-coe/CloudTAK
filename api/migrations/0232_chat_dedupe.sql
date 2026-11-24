DELETE FROM "profile_chats" a
    USING "profile_chats" b
    WHERE a.username = b.username
        AND a.message_id = b.message_id
        AND a.id > b.id;--> statement-breakpoint
UPDATE "profile_chats" SET "read" = true WHERE "read" = false;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "profile_chats_username_message_id_idx" ON "profile_chats" USING btree ("username","message_id");
--> statement-breakpoint
DELETE FROM "profile_chatroom";--> statement-breakpoint
ALTER TABLE "profile_chatroom" DROP CONSTRAINT IF EXISTS "profile_chatroom_pkey";--> statement-breakpoint
ALTER TABLE "profile_chatroom" DROP COLUMN IF EXISTS "icon";--> statement-breakpoint
ALTER TABLE "profile_chatroom" ADD COLUMN "type" text DEFAULT 'direct' NOT NULL;--> statement-breakpoint
ALTER TABLE "profile_chatroom" ADD COLUMN "parent" text;--> statement-breakpoint
ALTER TABLE "profile_chatroom" ADD COLUMN "members" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "profile_chatroom" ADD COLUMN "hierarchy" jsonb;--> statement-breakpoint
ALTER TABLE "profile_chatroom" ADD COLUMN "last_read" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "profile_chatroom" ADD CONSTRAINT "profile_chatroom_username_id_pk" PRIMARY KEY("username","id");--> statement-breakpoint
UPDATE "profile_chats" c
    SET chatroom = peer.uid
    FROM (
        SELECT DISTINCT ON (username, chatroom) username, chatroom, sender_uid AS uid
            FROM "profile_chats"
            WHERE sender_uid <> 'ANDROID-CloudTAK-' || username
            ORDER BY username, chatroom, created DESC, id DESC
    ) peer
    WHERE c.username = peer.username
        AND c.chatroom = peer.chatroom;--> statement-breakpoint
INSERT INTO "profile_chatroom" (username, id, name, created, updated)
    SELECT
        c.username,
        c.chatroom,
        COALESCE((
            SELECT p.sender_callsign
                FROM "profile_chats" p
                WHERE p.username = c.username
                    AND p.chatroom = c.chatroom
                    AND p.sender_uid = c.chatroom
                ORDER BY p.created DESC, p.id DESC
                LIMIT 1
        ), c.chatroom),
        MIN(c.created),
        MAX(c.created)
    FROM "profile_chats" c
    GROUP BY c.username, c.chatroom;--> statement-breakpoint
ALTER TABLE "profile_chats" ADD CONSTRAINT "profile_chats_chatroom_fk" FOREIGN KEY ("username","chatroom") REFERENCES "public"."profile_chatroom"("username","id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "profile_chats_username_chatroom_idx" ON "profile_chats" USING btree ("username","chatroom");

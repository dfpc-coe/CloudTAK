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
CREATE INDEX "profile_chats_username_chatroom_idx" ON "profile_chats" USING btree ("username","chatroom");--> statement-breakpoint
CREATE TABLE "chat_message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chatroom" uuid NOT NULL,
	"created" timestamp with time zone DEFAULT Now() NOT NULL,
	"updated" timestamp with time zone DEFAULT Now() NOT NULL,
	"sender_uid" text NOT NULL,
	"sender_callsign" text NOT NULL,
	"body" text NOT NULL,
	"reply_to" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"edited" timestamp with time zone,
	"deleted" timestamp with time zone,
	"status" text
);
--> statement-breakpoint
CREATE TABLE "chat_message_external" (
	"id" serial PRIMARY KEY NOT NULL,
	"message" uuid NOT NULL,
	"chatroom" uuid NOT NULL,
	"system" text NOT NULL,
	"external_id" text NOT NULL,
	CONSTRAINT "chat_message_external_chatroom_system_external_id_idx" UNIQUE("chatroom","system","external_id")
);
--> statement-breakpoint
CREATE TABLE "chat_message_receipt" (
	"message" uuid NOT NULL,
	"uid" text NOT NULL,
	"delivered" timestamp with time zone,
	"read" timestamp with time zone,
	CONSTRAINT "chat_message_receipt_message_uid_pk" PRIMARY KEY("message","uid")
);
--> statement-breakpoint
CREATE TABLE "chat_reaction" (
	"message" uuid NOT NULL,
	"uid" text NOT NULL,
	"emoji" text NOT NULL,
	"created" timestamp with time zone DEFAULT Now() NOT NULL,
	CONSTRAINT "chat_reaction_message_uid_emoji_pk" PRIMARY KEY("message","uid","emoji")
);
--> statement-breakpoint
CREATE TABLE "chatroom" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created" timestamp with time zone DEFAULT Now() NOT NULL,
	"updated" timestamp with time zone DEFAULT Now() NOT NULL,
	"type" text NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"key" text,
	CONSTRAINT "chatroom_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "chatroom_external" (
	"id" serial PRIMARY KEY NOT NULL,
	"chatroom" uuid NOT NULL,
	"system" text NOT NULL,
	"external_id" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "chatroom_external_system_external_id_idx" UNIQUE("system","external_id")
);
--> statement-breakpoint
CREATE TABLE "chatroom_member" (
	"id" serial PRIMARY KEY NOT NULL,
	"chatroom" uuid NOT NULL,
	"created" timestamp with time zone DEFAULT Now() NOT NULL,
	"uid" text NOT NULL,
	"callsign" text NOT NULL,
	"username" text,
	"role" text DEFAULT 'member' NOT NULL,
	"joined" timestamp with time zone DEFAULT Now() NOT NULL,
	"last_read" timestamp with time zone,
	"muted" boolean DEFAULT false NOT NULL,
	CONSTRAINT "chatroom_member_chatroom_uid_idx" UNIQUE("chatroom","uid")
);
--> statement-breakpoint
ALTER TABLE "chat_message" ADD CONSTRAINT "chat_message_chatroom_chatroom_id_fk" FOREIGN KEY ("chatroom") REFERENCES "public"."chatroom"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_message" ADD CONSTRAINT "chat_message_reply_to_chat_message_id_fk" FOREIGN KEY ("reply_to") REFERENCES "public"."chat_message"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_message_external" ADD CONSTRAINT "chat_message_external_message_chat_message_id_fk" FOREIGN KEY ("message") REFERENCES "public"."chat_message"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_message_external" ADD CONSTRAINT "chat_message_external_chatroom_chatroom_id_fk" FOREIGN KEY ("chatroom") REFERENCES "public"."chatroom"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_message_receipt" ADD CONSTRAINT "chat_message_receipt_message_chat_message_id_fk" FOREIGN KEY ("message") REFERENCES "public"."chat_message"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_reaction" ADD CONSTRAINT "chat_reaction_message_chat_message_id_fk" FOREIGN KEY ("message") REFERENCES "public"."chat_message"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chatroom_external" ADD CONSTRAINT "chatroom_external_chatroom_chatroom_id_fk" FOREIGN KEY ("chatroom") REFERENCES "public"."chatroom"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chatroom_member" ADD CONSTRAINT "chatroom_member_chatroom_chatroom_id_fk" FOREIGN KEY ("chatroom") REFERENCES "public"."chatroom"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chatroom_member" ADD CONSTRAINT "chatroom_member_username_profile_username_fk" FOREIGN KEY ("username") REFERENCES "public"."profile"("username") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_message_chatroom_created_idx" ON "chat_message" USING btree ("chatroom","created");--> statement-breakpoint
CREATE INDEX "chat_message_external_message_idx" ON "chat_message_external" USING btree ("message");--> statement-breakpoint
CREATE INDEX "chatroom_external_chatroom_idx" ON "chatroom_external" USING btree ("chatroom");--> statement-breakpoint
CREATE INDEX "chatroom_member_username_idx" ON "chatroom_member" USING btree ("username");--> statement-breakpoint
CREATE TABLE "_chat_backfill" AS
    SELECT
        room.*,
        'ANDROID-CloudTAK-' || room.username AS uid,
        CASE
            WHEN room.id = 'All Chat Rooms' THEN 'broadcast'
            WHEN room.type = 'direct' THEN 'direct'
            ELSE 'group'
        END AS kind,
        CASE
            WHEN room.id = 'All Chat Rooms' THEN 'broadcast:' || room.username
            WHEN room.type = 'direct' THEN 'direct:'
                || LEAST(('ANDROID-CloudTAK-' || room.username) COLLATE "C", room.id COLLATE "C")
                || '|'
                || GREATEST(('ANDROID-CloudTAK-' || room.username) COLLATE "C", room.id COLLATE "C")
            ELSE 'group:' || room.id
        END AS key
    FROM "profile_chatroom" room;--> statement-breakpoint
INSERT INTO "chatroom" (type, name, key, created, updated)
    SELECT
        MIN(kind),
        CASE WHEN MIN(kind) = 'direct' THEN '' ELSE (ARRAY_AGG(name ORDER BY updated DESC))[1] END,
        key,
        MIN(created),
        MAX(updated)
    FROM "_chat_backfill"
    GROUP BY key;--> statement-breakpoint
INSERT INTO "chatroom_member" (chatroom, uid, callsign, username, joined, last_read)
    SELECT
        room.id,
        backfill.uid,
        COALESCE((
            SELECT chat.sender_callsign
                FROM "profile_chats" chat
                WHERE chat.sender_uid = backfill.uid
                ORDER BY chat.created DESC, chat.id DESC
                LIMIT 1
        ), backfill.username),
        backfill.username,
        backfill.created,
        GREATEST(backfill.last_read, (
            SELECT MAX(chat.created)
                FROM "profile_chats" chat
                WHERE chat.username = backfill.username
                    AND chat.chatroom = backfill.id
                    AND chat.read
        ))
    FROM "_chat_backfill" backfill
        INNER JOIN "chatroom" room
            ON room.key = backfill.key
    ON CONFLICT (chatroom, uid) DO NOTHING;--> statement-breakpoint
INSERT INTO "chatroom_member" (chatroom, uid, callsign, username, joined)
    SELECT
        room.id,
        backfill.id,
        backfill.name,
        profile.username,
        backfill.created
    FROM "_chat_backfill" backfill
        INNER JOIN "chatroom" room
            ON room.key = backfill.key
        LEFT JOIN "profile" profile
            ON 'ANDROID-CloudTAK-' || profile.username = backfill.id
    WHERE backfill.kind = 'direct'
    ON CONFLICT (chatroom, uid) DO NOTHING;--> statement-breakpoint
INSERT INTO "chatroom_member" (chatroom, uid, callsign, username, joined)
    SELECT DISTINCT ON (room.id, member->>'uid')
        room.id,
        member->>'uid',
        COALESCE(member->>'callsign', member->>'uid'),
        profile.username,
        backfill.created
    FROM "_chat_backfill" backfill
        INNER JOIN "chatroom" room
            ON room.key = backfill.key
        CROSS JOIN LATERAL jsonb_array_elements(backfill.members) member
        LEFT JOIN "profile" profile
            ON 'ANDROID-CloudTAK-' || profile.username = member->>'uid'
    WHERE backfill.kind = 'group'
        AND member->>'uid' IS NOT NULL
    ON CONFLICT (chatroom, uid) DO NOTHING;--> statement-breakpoint
INSERT INTO "chatroom_external" (chatroom, system, external_id, metadata)
    SELECT DISTINCT ON (room.id)
        room.id,
        'tak',
        backfill.id,
        jsonb_strip_nulls(jsonb_build_object('parent', backfill.parent, 'hierarchy', backfill.hierarchy))
    FROM "_chat_backfill" backfill
        INNER JOIN "chatroom" room
            ON room.key = backfill.key
    WHERE backfill.kind = 'group'
    ORDER BY room.id, backfill.updated DESC;--> statement-breakpoint
ALTER TABLE "chat_message" ADD COLUMN "_external" text;--> statement-breakpoint
INSERT INTO "chat_message" (chatroom, created, updated, sender_uid, sender_callsign, body, status, _external)
    SELECT DISTINCT ON (room.id, chat.message_id)
        room.id,
        chat.created,
        chat.updated,
        chat.sender_uid,
        chat.sender_callsign,
        chat.message,
        chat.status,
        chat.message_id
    FROM "profile_chats" chat
        INNER JOIN "_chat_backfill" backfill
            ON backfill.username = chat.username
                AND backfill.id = chat.chatroom
        INNER JOIN "chatroom" room
            ON room.key = backfill.key
    ORDER BY room.id, chat.message_id, (chat.status IS NULL), chat.created, chat.id;--> statement-breakpoint
INSERT INTO "chat_message_external" (message, chatroom, system, external_id)
    SELECT id, chatroom, 'tak', _external
        FROM "chat_message";--> statement-breakpoint
ALTER TABLE "chat_message" DROP COLUMN "_external";--> statement-breakpoint
UPDATE "chatroom" SET key = NULL WHERE type = 'group';--> statement-breakpoint
DROP TABLE "_chat_backfill";--> statement-breakpoint
DROP TABLE "profile_chats" CASCADE;--> statement-breakpoint
DROP TABLE "profile_chatroom" CASCADE;

CREATE TABLE IF NOT EXISTS "chat_message" (
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
CREATE TABLE IF NOT EXISTS "chat_message_external" (
	"id" serial PRIMARY KEY NOT NULL,
	"message" uuid NOT NULL,
	"chatroom" uuid NOT NULL,
	"system" text NOT NULL,
	"external_id" text NOT NULL,
	CONSTRAINT "chat_message_external_chatroom_system_external_id_idx" UNIQUE("chatroom","system","external_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "chat_message_receipt" (
	"message" uuid NOT NULL,
	"uid" text NOT NULL,
	"delivered" timestamp with time zone,
	"read" timestamp with time zone,
	CONSTRAINT "chat_message_receipt_message_uid_pk" PRIMARY KEY("message","uid")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "chat_reaction" (
	"message" uuid NOT NULL,
	"uid" text NOT NULL,
	"emoji" text NOT NULL,
	"created" timestamp with time zone DEFAULT Now() NOT NULL,
	CONSTRAINT "chat_reaction_message_uid_emoji_pk" PRIMARY KEY("message","uid","emoji")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "chatroom" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created" timestamp with time zone DEFAULT Now() NOT NULL,
	"updated" timestamp with time zone DEFAULT Now() NOT NULL,
	"type" text NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"key" text,
	CONSTRAINT "chatroom_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "chatroom_external" (
	"id" serial PRIMARY KEY NOT NULL,
	"chatroom" uuid NOT NULL,
	"system" text NOT NULL,
	"external_id" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "chatroom_external_system_external_id_idx" UNIQUE("system","external_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "chatroom_member" (
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
DO $$ BEGIN
 ALTER TABLE "chat_message" ADD CONSTRAINT "chat_message_chatroom_chatroom_id_fk" FOREIGN KEY ("chatroom") REFERENCES "public"."chatroom"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chat_message" ADD CONSTRAINT "chat_message_reply_to_chat_message_id_fk" FOREIGN KEY ("reply_to") REFERENCES "public"."chat_message"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chat_message_external" ADD CONSTRAINT "chat_message_external_message_chat_message_id_fk" FOREIGN KEY ("message") REFERENCES "public"."chat_message"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chat_message_external" ADD CONSTRAINT "chat_message_external_chatroom_chatroom_id_fk" FOREIGN KEY ("chatroom") REFERENCES "public"."chatroom"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chat_message_receipt" ADD CONSTRAINT "chat_message_receipt_message_chat_message_id_fk" FOREIGN KEY ("message") REFERENCES "public"."chat_message"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chat_reaction" ADD CONSTRAINT "chat_reaction_message_chat_message_id_fk" FOREIGN KEY ("message") REFERENCES "public"."chat_message"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chatroom_external" ADD CONSTRAINT "chatroom_external_chatroom_chatroom_id_fk" FOREIGN KEY ("chatroom") REFERENCES "public"."chatroom"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chatroom_member" ADD CONSTRAINT "chatroom_member_chatroom_chatroom_id_fk" FOREIGN KEY ("chatroom") REFERENCES "public"."chatroom"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chatroom_member" ADD CONSTRAINT "chatroom_member_username_profile_username_fk" FOREIGN KEY ("username") REFERENCES "public"."profile"("username") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_message_chatroom_created_idx" ON "chat_message" USING btree ("chatroom","created");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_message_external_message_idx" ON "chat_message_external" USING btree ("message");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chatroom_external_chatroom_idx" ON "chatroom_external" USING btree ("chatroom");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chatroom_member_username_idx" ON "chatroom_member" USING btree ("username");--> statement-breakpoint
DO $$ BEGIN
    IF to_regclass('public.profile_chats') IS NULL THEN
        RETURN;
    END IF;

    CREATE TEMP TABLE "_chat" AS
        SELECT DISTINCT ON (username, message_id) *
            FROM "profile_chats"
            ORDER BY username, message_id, id;

    CREATE TEMP TABLE "_chat_room" AS
        SELECT
            room.username,
            room.chatroom,
            room.created,
            room.updated,
            room.uid,
            COALESCE(peer.uid, room.chatroom) AS peer_uid,
            COALESCE(peer.callsign, room.chatroom) AS peer_callsign,
            CASE WHEN room.chatroom = 'All Chat Rooms' THEN 'broadcast' ELSE 'direct' END AS type,
            CASE
                WHEN room.chatroom = 'All Chat Rooms' THEN 'broadcast:' || room.username
                ELSE 'direct:'
                    || LEAST(room.uid COLLATE "C", COALESCE(peer.uid, room.chatroom) COLLATE "C")
                    || '|'
                    || GREATEST(room.uid COLLATE "C", COALESCE(peer.uid, room.chatroom) COLLATE "C")
            END AS key
        FROM (
            SELECT
                username,
                chatroom,
                'ANDROID-CloudTAK-' || username AS uid,
                MIN(created) AS created,
                MAX(created) AS updated
            FROM "_chat"
            GROUP BY username, chatroom
        ) room
            LEFT JOIN LATERAL (
                SELECT
                    chat.sender_uid AS uid,
                    chat.sender_callsign AS callsign
                FROM "_chat" chat
                WHERE chat.username = room.username
                    AND chat.chatroom = room.chatroom
                    AND chat.sender_uid <> room.uid
                ORDER BY chat.created DESC, chat.id DESC
                LIMIT 1
            ) peer ON true;

    INSERT INTO "chatroom" (type, name, key, created, updated)
        SELECT
            MIN(type),
            CASE WHEN MIN(type) = 'broadcast' THEN 'All Chat Rooms' ELSE '' END,
            key,
            MIN(created),
            MAX(updated)
        FROM "_chat_room"
        GROUP BY key
        ON CONFLICT (key) DO NOTHING;

    INSERT INTO "chatroom_member" (chatroom, uid, callsign, username, joined, last_read)
        SELECT
            room.id,
            legacy.uid,
            COALESCE((
                SELECT chat.sender_callsign
                    FROM "_chat" chat
                    WHERE chat.sender_uid = legacy.uid
                    ORDER BY chat.created DESC, chat.id DESC
                    LIMIT 1
            ), legacy.username),
            legacy.username,
            MIN(legacy.created),
            MAX(legacy.updated)
        FROM "_chat_room" legacy
            INNER JOIN "chatroom" room
                ON room.key = legacy.key
        GROUP BY room.id, legacy.uid, legacy.username
        ON CONFLICT (chatroom, uid) DO NOTHING;

    INSERT INTO "chatroom_member" (chatroom, uid, callsign, username, joined)
        SELECT DISTINCT ON (room.id, legacy.peer_uid)
            room.id,
            legacy.peer_uid,
            legacy.peer_callsign,
            profile.username,
            room.created
        FROM "_chat_room" legacy
            INNER JOIN "chatroom" room
                ON room.key = legacy.key
            LEFT JOIN "profile" profile
                ON 'ANDROID-CloudTAK-' || profile.username = legacy.peer_uid
        WHERE legacy.type = 'direct'
        ORDER BY room.id, legacy.peer_uid, legacy.updated DESC
        ON CONFLICT (chatroom, uid) DO NOTHING;

    CREATE TEMP TABLE "_chat_message" AS
        SELECT DISTINCT ON (room.id, chat.message_id)
            gen_random_uuid() AS id,
            room.id AS chatroom,
            chat.created,
            chat.updated,
            chat.sender_uid,
            chat.sender_callsign,
            chat.message,
            chat.status,
            chat.message_id
        FROM "_chat" chat
            INNER JOIN "_chat_room" legacy
                ON legacy.username = chat.username
                    AND legacy.chatroom = chat.chatroom
            INNER JOIN "chatroom" room
                ON room.key = legacy.key
        WHERE NOT EXISTS (
            SELECT 1
                FROM "chat_message_external" external
                WHERE external.chatroom = room.id
                    AND external.system = 'tak'
                    AND external.external_id = chat.message_id
        )
        ORDER BY room.id, chat.message_id, (chat.status IS NULL), chat.created, chat.id;

    INSERT INTO "chat_message" (id, chatroom, created, updated, sender_uid, sender_callsign, body, status)
        SELECT id, chatroom, created, updated, sender_uid, sender_callsign, message, status
            FROM "_chat_message";

    INSERT INTO "chat_message_external" (message, chatroom, system, external_id)
        SELECT id, chatroom, 'tak', message_id
            FROM "_chat_message";

    DROP TABLE "_chat_message";
    DROP TABLE "_chat_room";
    DROP TABLE "_chat";
END $$;--> statement-breakpoint
DROP TABLE IF EXISTS "profile_chats";--> statement-breakpoint
DROP TABLE IF EXISTS "profile_chatroom";

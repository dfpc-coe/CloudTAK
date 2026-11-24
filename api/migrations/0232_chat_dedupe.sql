DELETE FROM "profile_chats" a
    USING "profile_chats" b
    WHERE a.username = b.username
        AND a.message_id = b.message_id
        AND a.id > b.id;--> statement-breakpoint
UPDATE "profile_chats" SET "read" = true WHERE "read" = false;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "profile_chats_username_message_id_idx" ON "profile_chats" USING btree ("username","message_id");

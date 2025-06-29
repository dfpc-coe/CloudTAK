CREATE TABLE IF NOT EXISTS "profile_chats" (
	"username" text PRIMARY KEY NOT NULL,
	"chatroom" text NOT NULL,
	"sender_callsign" text NOT NULL,
	"sender_uid" text NOT NULL,
	"created" timestamp with time zone DEFAULT Now() NOT NULL,
	"updated" timestamp with time zone DEFAULT Now() NOT NULL,
	"message_id" text NOT NULL,
	"message" text NOT NULL
);

CREATE TABLE IF NOT EXISTS "profile_passkey_challenges" (
	"key" text PRIMARY KEY NOT NULL,
	"challenge" text NOT NULL,
	"expires" timestamp with time zone NOT NULL
);

CREATE TABLE IF NOT EXISTS "profile_subscriptions" (
	"username" text PRIMARY KEY NOT NULL,
	"created" timestamp with time zone DEFAULT Now() NOT NULL,
	"updated" timestamp with time zone DEFAULT Now() NOT NULL,
	"mission" text NOT NULL
);

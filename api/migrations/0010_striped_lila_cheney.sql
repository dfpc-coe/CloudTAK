CREATE TABLE IF NOT EXISTS "profile_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"created" timestamp with time zone DEFAULT Now() NOT NULL,
	"updated" timestamp with time zone DEFAULT Now() NOT NULL,
	"mission" text NOT NULL
);

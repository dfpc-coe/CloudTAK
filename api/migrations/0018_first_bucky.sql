CREATE TABLE IF NOT EXISTS "profile_missions" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"guid" text NOT NULL,
	"token" text NOT NULL,
	"created" timestamp with time zone DEFAULT Now() NOT NULL,
	"updated" timestamp with time zone DEFAULT Now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "tasks" (
	"prefix" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"repo" text,
	"readme" text
);

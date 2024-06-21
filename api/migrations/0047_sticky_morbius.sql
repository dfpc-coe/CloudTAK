CREATE TABLE IF NOT EXISTS "tasks" (
    "id" serial PRIMARY KEY,
    "prefix" text NOT NULL,
    "created" timestamp with time zone DEFAULT Now() NOT NULL,
    "updated" timestamp with time zone DEFAULT Now() NOT NULL,
    "name" text NOT NULL,
    "repo" text,
    "readme" text
);

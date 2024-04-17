CREATE TABLE IF NOT EXISTS "overlays" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created" timestamp with time zone DEFAULT Now() NOT NULL,
	"updated" timestamp with time zone DEFAULT Now() NOT NULL,
	"type" text DEFAULT 'vector' NOT NULL,
	"styles" json,
	"url" text NOT NULL
);

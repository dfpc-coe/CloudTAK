CREATE TABLE IF NOT EXISTS "core_incident" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"external_id" text,
	"status" text DEFAULT 'Active' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"created" timestamp with time zone DEFAULT Now() NOT NULL,
	"updated" timestamp with time zone DEFAULT Now() NOT NULL,
	"bounds" GEOMETRY(POLYGON, 4326),
	"center" GEOMETRY(POINT, 4326),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);

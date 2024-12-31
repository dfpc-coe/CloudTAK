CREATE TABLE "profile_interests" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"bounds" "GEOMETRY(POLYGON, 4326)",
	"created" timestamp with time zone DEFAULT Now() NOT NULL,
	"updated" timestamp with time zone DEFAULT Now() NOT NULL
);

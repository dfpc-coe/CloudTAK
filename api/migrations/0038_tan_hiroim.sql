CREATE TABLE IF NOT EXISTS "profile_features" (
	"id" text PRIMARY KEY NOT NULL,
	"username" text NOT NULL REFERENCES profile(username),
	"properties" json DEFAULT '{}'::json NOT NULL,
	"geometry" GEOMETRY(GEOMETRY, 4326) NOT NULL
);

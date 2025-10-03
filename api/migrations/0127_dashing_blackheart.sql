CREATE TABLE "connection_features" (
	"id" text NOT NULL,
	"path" text DEFAULT '/' NOT NULL,
	"connection" integer NOT NULL,
	"properties" json DEFAULT '{}'::json NOT NULL,
	"geometry" GEOMETRY(GEOMETRYZ, 4326) NOT NULL,
	CONSTRAINT "connection_features_connection_id_pk" PRIMARY KEY("connection","id")
);
--> statement-breakpoint
ALTER TABLE "layers_incoming" ADD COLUMN "groups" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "connection_features" ADD CONSTRAINT "connection_features_connection_connections_id_fk" FOREIGN KEY ("connection") REFERENCES "public"."connections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "connection_features_connection_idx" ON "connection_features" USING btree ("connection");

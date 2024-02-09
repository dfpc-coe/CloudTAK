CREATE TABLE IF NOT EXISTS "connection_tokens" (
	"id" serial NOT NULL,
	"connection" integer NOT NULL,
	"name" text NOT NULL,
	"token" text PRIMARY KEY NOT NULL,
	"created" timestamp with time zone DEFAULT Now() NOT NULL,
	"updated" timestamp with time zone DEFAULT Now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "connection_tokens" ADD CONSTRAINT "connection_tokens_connection_connections_id_fk" FOREIGN KEY ("connection") REFERENCES "connections"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

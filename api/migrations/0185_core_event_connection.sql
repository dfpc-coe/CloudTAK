ALTER TABLE "core_event" ADD COLUMN IF NOT EXISTS "connection" integer;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "core_event" ADD CONSTRAINT "core_event_connection_connections_id_fk" FOREIGN KEY ("connection") REFERENCES "public"."connections"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

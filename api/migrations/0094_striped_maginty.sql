ALTER TABLE "video_lease_permission" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "video_lease_permission" CASCADE;--> statement-breakpoint
ALTER TABLE "video_lease" ALTER COLUMN "username" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "video_lease" ADD COLUMN "connection" integer;--> statement-breakpoint
ALTER TABLE "video_lease" ADD CONSTRAINT "video_lease_connection_connections_id_fk" FOREIGN KEY ("connection") REFERENCES "public"."connections"("id") ON DELETE no action ON UPDATE no action;
CREATE TABLE IF NOT EXISTS "video_lease" (
	"id" serial PRIMARY KEY NOT NULL,
	"created" timestamp with time zone DEFAULT Now() NOT NULL,
	"updated" timestamp with time zone DEFAULT Now() NOT NULL,
	"username" text NOT NULL,
	"expiration" timestamp with time zone DEFAULT Now() + INTERVAL '1 HOUR' NOT NULL,
	"path" text NOT NULL
);
--> statement-breakpoint
/* 
    Unfortunately in current drizzle-kit version we can't automatically get name for primary key.
    We are working on making it available!

    Meanwhile you can:
        1. Check pk name in your database, by running
            SELECT constraint_name FROM information_schema.table_constraints
            WHERE table_schema = 'public'
                AND table_name = 'tasks'
                AND constraint_type = 'PRIMARY KEY';
        2. Uncomment code below and paste pk name manually
        
    Hope to release this update as soon as possible
*/

DO $$ BEGIN
 ALTER TABLE "video_lease" ADD CONSTRAINT "video_lease_username_profile_username_fk" FOREIGN KEY ("username") REFERENCES "public"."profile"("username") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_prefix_unique" UNIQUE("prefix");

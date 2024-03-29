/* 
    Unfortunately in current drizzle-kit version we can't automatically get name for primary key.
    We are working on making it available!

    Meanwhile you can:
        1. Check pk name in your database, by running
            SELECT constraint_name FROM information_schema.table_constraints
            WHERE table_schema = 'public'
                AND table_name = 'profile_chats'
                AND constraint_type = 'PRIMARY KEY';
        2. Uncomment code below and paste pk name manually
        
    Hope to release this update as soon as possible
*/

-- ALTER TABLE "profile_chats" DROP CONSTRAINT "<constraint_name>";--> statement-breakpoint
ALTER TABLE "profile_chats" ADD COLUMN "id" serial NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "profile_chats" ADD CONSTRAINT "profile_chats_username_profile_username_fk" FOREIGN KEY ("username") REFERENCES "profile"("username") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

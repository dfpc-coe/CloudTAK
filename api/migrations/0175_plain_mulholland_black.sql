CREATE TABLE IF NOT EXISTS "profile_paging" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"seed" text NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"created" timestamp with time zone DEFAULT Now() NOT NULL,
	"updated" timestamp with time zone DEFAULT Now() NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"type" text NOT NULL,
	"value" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "profile_paging" ADD CONSTRAINT "profile_paging_username_profile_username_fk" FOREIGN KEY ("username") REFERENCES "public"."profile"("username") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
ALTER TABLE "profile_sessions" DROP COLUMN IF EXISTS "fcm";
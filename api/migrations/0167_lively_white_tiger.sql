CREATE TABLE IF NOT EXISTS "profile_file_channel" (
	"id" serial PRIMARY KEY NOT NULL,
	"created" timestamp with time zone DEFAULT Now() NOT NULL,
	"updated" timestamp with time zone DEFAULT Now() NOT NULL,
	"file" uuid NOT NULL,
	"channel" bigint NOT NULL,
	CONSTRAINT "profile_file_channel_file_channel_unique" UNIQUE("file","channel")
);
--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint WHERE conname = 'profile_file_channel_file_channel_unique'
	) THEN
		ALTER TABLE "profile_file_channel" ADD CONSTRAINT "profile_file_channel_file_channel_unique" UNIQUE("file","channel");
	END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint WHERE conname = 'profile_file_channel_file_profile_files_id_fk'
	) THEN
		ALTER TABLE "profile_file_channel" ADD CONSTRAINT "profile_file_channel_file_profile_files_id_fk" FOREIGN KEY ("file") REFERENCES "public"."profile_files"("id") ON DELETE no action ON UPDATE no action;
	END IF;
END $$;
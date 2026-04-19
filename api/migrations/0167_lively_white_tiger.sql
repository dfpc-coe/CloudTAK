CREATE TABLE "profile_file_channel" (
	"id" serial PRIMARY KEY NOT NULL,
	"created" timestamp with time zone DEFAULT Now() NOT NULL,
	"updated" timestamp with time zone DEFAULT Now() NOT NULL,
	"file" uuid NOT NULL,
	"channel" bigint NOT NULL,
	CONSTRAINT "profile_file_channel_file_channel_unique" UNIQUE("file","channel")
);
--> statement-breakpoint
ALTER TABLE "profile_file_channel" ADD CONSTRAINT "profile_file_channel_file_profile_files_id_fk" FOREIGN KEY ("file") REFERENCES "public"."profile_files"("id") ON DELETE no action ON UPDATE no action;
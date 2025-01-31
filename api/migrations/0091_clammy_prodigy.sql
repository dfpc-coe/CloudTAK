CREATE TABLE "errors" (
	"id" serial PRIMARY KEY NOT NULL,
	"created" timestamp with time zone DEFAULT Now() NOT NULL,
	"updated" timestamp with time zone DEFAULT Now() NOT NULL,
	"username" text NOT NULL,
	"message" text NOT NULL,
	"trace" text
);
--> statement-breakpoint
ALTER TABLE "errors" ADD CONSTRAINT "errors_username_profile_username_fk" FOREIGN KEY ("username") REFERENCES "public"."profile"("username") ON DELETE no action ON UPDATE no action;

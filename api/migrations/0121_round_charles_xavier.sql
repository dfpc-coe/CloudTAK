ALTER TABLE "tokens" RENAME TO "profile_tokens";--> statement-breakpoint
ALTER TABLE "profile_tokens" RENAME COLUMN "email" TO "username";--> statement-breakpoint
ALTER TABLE "profile_tokens" ADD CONSTRAINT "profile_tokens_username_profile_username_fk" FOREIGN KEY ("username") REFERENCES "public"."profile"("username") ON DELETE no action ON UPDATE no action;

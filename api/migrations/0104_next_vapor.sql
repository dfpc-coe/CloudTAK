ALTER TABLE "connections" ADD COLUMN "username" text;--> statement-breakpoint
ALTER TABLE "data" ADD COLUMN "username" text;--> statement-breakpoint
ALTER TABLE "layers" ADD COLUMN "username" text;--> statement-breakpoint
ALTER TABLE "connections" ADD CONSTRAINT "connections_username_profile_username_fk" FOREIGN KEY ("username") REFERENCES "public"."profile"("username") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data" ADD CONSTRAINT "data_username_profile_username_fk" FOREIGN KEY ("username") REFERENCES "public"."profile"("username") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "layers" ADD CONSTRAINT "layers_username_profile_username_fk" FOREIGN KEY ("username") REFERENCES "public"."profile"("username") ON DELETE no action ON UPDATE no action;
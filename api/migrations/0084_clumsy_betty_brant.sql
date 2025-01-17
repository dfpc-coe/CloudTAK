CREATE TABLE "fusion_type" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"schema" json NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profile_fusion" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"fusion" integer NOT NULL,
	"value" json DEFAULT '{}'::json NOT NULL
);
--> statement-breakpoint
ALTER TABLE "profile_fusion" ADD CONSTRAINT "profile_fusion_username_profile_username_fk" FOREIGN KEY ("username") REFERENCES "public"."profile"("username") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_fusion" ADD CONSTRAINT "profile_fusion_fusion_fusion_type_id_fk" FOREIGN KEY ("fusion") REFERENCES "public"."fusion_type"("id") ON DELETE no action ON UPDATE no action;
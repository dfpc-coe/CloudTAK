CREATE TABLE "palette" (
	"uuid" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "palette_feature" (
	"uuid" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"palette" uuid NOT NULL,
	"type" text NOT NULL,
	"style" json DEFAULT '{}'::json NOT NULL
);
--> statement-breakpoint
ALTER TABLE "palette_feature" ADD CONSTRAINT "palette_feature_palette_palette_uuid_fk" FOREIGN KEY ("palette") REFERENCES "public"."palette"("uuid") ON DELETE no action ON UPDATE no action;

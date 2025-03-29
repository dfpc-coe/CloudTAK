CREATE TABLE "palette" (
	"uuid" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pallete" text NOT NULL,
	"type" text NOT NULL,
	"style" json DEFAULT '{}'::json NOT NULL
);
--> statement-breakpoint
ALTER TABLE "palette" ADD CONSTRAINT "palette_pallete_palette_uuid_fk" FOREIGN KEY ("pallete") REFERENCES "public"."palette"("uuid") ON DELETE no action ON UPDATE no action;
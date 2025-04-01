ALTER TABLE "palette_feature" RENAME COLUMN "pallete" TO "palette";--> statement-breakpoint
ALTER TABLE "palette_feature" DROP CONSTRAINT "palette_feature_pallete_palette_uuid_fk";
--> statement-breakpoint
ALTER TABLE "palette" ADD COLUMN "created" timestamp with time zone DEFAULT Now() NOT NULL;--> statement-breakpoint
ALTER TABLE "palette" ADD COLUMN "updated" timestamp with time zone DEFAULT Now() NOT NULL;--> statement-breakpoint
ALTER TABLE "palette_feature" ADD COLUMN "created" timestamp with time zone DEFAULT Now() NOT NULL;--> statement-breakpoint
ALTER TABLE "palette_feature" ADD COLUMN "updated" timestamp with time zone DEFAULT Now() NOT NULL;--> statement-breakpoint
ALTER TABLE "palette_feature" ADD COLUMN "name" text NOT NULL;--> statement-breakpoint
ALTER TABLE "palette_feature" ADD CONSTRAINT "palette_feature_palette_palette_uuid_fk" FOREIGN KEY ("palette") REFERENCES "public"."palette"("uuid") ON DELETE no action ON UPDATE no action;
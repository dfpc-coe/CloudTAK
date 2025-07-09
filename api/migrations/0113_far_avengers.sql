ALTER TABLE "layers" ALTER COLUMN "memory" SET DEFAULT 256;--> statement-breakpoint
ALTER TABLE "layers" ALTER COLUMN "timeout" SET DEFAULT 120;--> statement-breakpoint
ALTER TABLE "iconsets" ADD COLUMN "spritesheet_data" text;--> statement-breakpoint
ALTER TABLE "iconsets" ADD COLUMN "spritesheet_json" json;
ALTER TABLE "layers" ALTER COLUMN "memory" SET DEFAULT 256;--> statement-breakpoint
ALTER TABLE "layers" ALTER COLUMN "timeout" SET DEFAULT 120;--> statement-breakpoint
ALTER TABLE "basemaps" ADD COLUMN "tilesize" integer DEFAULT 256 NOT NULL;
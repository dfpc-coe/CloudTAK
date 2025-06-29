DROP TABLE "data_mission";--> statement-breakpoint
ALTER TABLE "data" ADD COLUMN "mission_sync" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "data" ADD COLUMN "assets" json DEFAULT '["*"]'::json NOT NULL;

ALTER TABLE "connection_features" ADD COLUMN IF NOT EXISTS "enabled_geofence" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "profile_features" ADD COLUMN IF NOT EXISTS "enabled_geofence" boolean DEFAULT false NOT NULL;

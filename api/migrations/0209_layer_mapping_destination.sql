ALTER TABLE "layer_mapping" ADD COLUMN IF NOT EXISTS "destination" text DEFAULT 'CoreFeature' NOT NULL;
--> statement-breakpoint
ALTER TABLE "layer_mapping" ADD COLUMN IF NOT EXISTS "name" text DEFAULT '' NOT NULL;

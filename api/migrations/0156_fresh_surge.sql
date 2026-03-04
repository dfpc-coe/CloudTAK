ALTER TABLE "layers" ADD COLUMN IF NOT EXISTS "protected" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "layers_incoming" DROP COLUMN IF EXISTS "groups";
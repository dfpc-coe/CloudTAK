ALTER TABLE "layers" ADD COLUMN "protected" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "layers_incoming" DROP COLUMN "groups";
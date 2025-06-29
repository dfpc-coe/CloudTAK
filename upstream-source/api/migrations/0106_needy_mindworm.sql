ALTER TABLE "layers_template" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "layers_template" CASCADE;--> statement-breakpoint
ALTER TABLE "layers" ALTER COLUMN "connection" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "layers" ADD COLUMN "template" boolean DEFAULT false NOT NULL;
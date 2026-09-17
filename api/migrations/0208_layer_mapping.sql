CREATE TABLE IF NOT EXISTS "layer_mapping" (
	"id" serial PRIMARY KEY NOT NULL,
	"created" timestamp with time zone DEFAULT Now() NOT NULL,
	"updated" timestamp with time zone DEFAULT Now() NOT NULL,
	"layer" integer NOT NULL,
	"schema" text NOT NULL,
	"query" text,
	"mapping" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conrelid = 'public.layer_mapping'::REGCLASS
		AND conname = 'layer_mapping_layer_layers_id_fk'
	) THEN
		ALTER TABLE "layer_mapping" ADD CONSTRAINT "layer_mapping_layer_layers_id_fk" FOREIGN KEY ("layer") REFERENCES "public"."layers"("id") ON DELETE cascade ON UPDATE no action;
	END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "layer_mapping_layer_idx" ON "layer_mapping" USING btree ("layer");

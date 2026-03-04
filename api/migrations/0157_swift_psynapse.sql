ALTER TABLE "connection_features" ADD COLUMN IF NOT EXISTS "layer" integer;--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'connection_features_layer_layers_id_fk'
    ) THEN
        ALTER TABLE "connection_features" ADD CONSTRAINT "connection_features_layer_layers_id_fk" FOREIGN KEY ("layer") REFERENCES "public"."layers"("id") ON DELETE no action ON UPDATE no action;
    END IF;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "connection_features_connection_layer_idx" ON "connection_features" USING btree ("connection","layer");
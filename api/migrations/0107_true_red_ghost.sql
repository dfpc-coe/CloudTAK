ALTER TABLE "layers_outgoing" ADD COLUMN "filters" json DEFAULT '{}'::json NOT NULL;

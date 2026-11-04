CREATE TABLE IF NOT EXISTS "core_entity_external" (
	"entity" uuid NOT NULL,
	"connection" integer,
	"kind" text NOT NULL,
	"system" text NOT NULL,
	"value" text NOT NULL,
	CONSTRAINT "core_entity_external_entity_system_pk" PRIMARY KEY("entity","system")
);
--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'core_entity_external_entity_core_entity_id_fk' AND conrelid = to_regclass('public.core_entity_external')
	) THEN
		ALTER TABLE "core_entity_external" ADD CONSTRAINT "core_entity_external_entity_core_entity_id_fk" FOREIGN KEY ("entity") REFERENCES "public"."core_entity"("id") ON DELETE cascade ON UPDATE no action;
	END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'core_entity_external_connection_connections_id_fk' AND conrelid = to_regclass('public.core_entity_external')
	) THEN
		ALTER TABLE "core_entity_external" ADD CONSTRAINT "core_entity_external_connection_connections_id_fk" FOREIGN KEY ("connection") REFERENCES "public"."connections"("id") ON DELETE set null ON UPDATE no action;
	END IF;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "core_entity_external_connection_kind_system_value_idx" ON "core_entity_external" USING btree ("connection","kind","system","value");--> statement-breakpoint
-- Existing external IDs are filed under the default system, which is what Layer submissions UPSERT on when their Map names no system
DO $$ BEGIN
	IF EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema = 'public' AND table_name = 'core_entity' AND column_name = 'external_id'
	) THEN
		INSERT INTO "core_entity_external" ("entity", "connection", "kind", "system", "value")
		SELECT "id", "connection", "kind", 'default', "external_id" FROM "core_entity"
		WHERE "external_id" <> ''
		ON CONFLICT DO NOTHING;
	END IF;
END $$;--> statement-breakpoint
-- Layer Mappings saved with the External ID template at external_id itself - a bare string or a { value, update } entry - become { value: ... } so they keep matching their records
UPDATE "layer_mapping"
SET "mapping" = jsonb_set("mapping", '{external_id}', jsonb_build_object('value', "mapping"->'external_id'))
WHERE jsonb_typeof("mapping"->'external_id') = 'string'
OR (jsonb_typeof("mapping"->'external_id') = 'object' AND "mapping"->'external_id' ? 'update' AND NOT "mapping"->'external_id' ? 'system');--> statement-breakpoint
DROP INDEX IF EXISTS "core_entity_connection_kind_external_id_idx";--> statement-breakpoint
ALTER TABLE "core_entity" DROP COLUMN IF EXISTS "external_id";

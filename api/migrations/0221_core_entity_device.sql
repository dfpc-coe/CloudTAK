ALTER TABLE "core_entity" ALTER COLUMN "geometry" DROP NOT NULL;--> statement-breakpoint
DROP INDEX IF EXISTS "core_entity_connection_external_id_idx";--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "core_entity_connection_kind_external_id_idx" ON "core_entity" USING btree ("connection","kind","external_id") WHERE external_id <> '';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "core_entity_device" (
	"id" uuid PRIMARY KEY NOT NULL,
	"manufacturer" text DEFAULT '' NOT NULL,
	"model" text DEFAULT '' NOT NULL,
	"serial" text DEFAULT '' NOT NULL,
	"firmware" text DEFAULT '' NOT NULL,
	"status" text DEFAULT '' NOT NULL,
	"battery" double precision,
	"simulated" boolean DEFAULT false NOT NULL
);--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'core_entity_device_id_core_entity_id_fk' AND conrelid = to_regclass('public.core_entity_device')
	) THEN
		ALTER TABLE "core_entity_device" ADD CONSTRAINT "core_entity_device_id_core_entity_id_fk" FOREIGN KEY ("id") REFERENCES "public"."core_entity"("id") ON DELETE cascade ON UPDATE no action;
	END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
	IF to_regclass('public.core_device') IS NOT NULL THEN
		INSERT INTO "core_entity" ("id", "kind", "created", "updated", "username", "connection", "type", "name", "external_id", "remarks", "metadata")
		SELECT "id", 'CoreDevice', "created", "updated", "username", "connection", "type", "name", "external_id", "remarks", "metadata" FROM "core_device"
		ON CONFLICT ("id") DO NOTHING;

		INSERT INTO "core_entity_device" ("id", "manufacturer", "model", "serial", "firmware", "status", "battery", "simulated")
		SELECT "id", "manufacturer", "model", "serial", "firmware", "status", "battery", "simulated" FROM "core_device"
		ON CONFLICT ("id") DO NOTHING;

		-- The dropped core_device.event assignment is kept as an active Effect
		INSERT INTO "core_entity_effect" ("event", "device", "action", "status")
		SELECT d."event", d."id", 'assigned', 'active' FROM "core_device" d
		WHERE d."event" IS NOT NULL
		AND NOT EXISTS (
			SELECT 1 FROM "core_entity_effect" e
			WHERE e."event" = d."event" AND e."device" = d."id" AND e."action" = 'assigned'
		);
	END IF;

	IF to_regclass('public.core_device_channel') IS NOT NULL THEN
		INSERT INTO "core_entity_channel" ("entity", "channel")
		SELECT "device", "channel" FROM "core_device_channel"
		ON CONFLICT DO NOTHING;
	END IF;
END $$;--> statement-breakpoint
ALTER TABLE "core_entity_effect" DROP CONSTRAINT IF EXISTS "core_entity_effect_device_core_device_id_fk";--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'core_entity_effect_device_core_entity_id_fk' AND conrelid = to_regclass('public.core_entity_effect')
	) THEN
		ALTER TABLE "core_entity_effect" ADD CONSTRAINT "core_entity_effect_device_core_entity_id_fk" FOREIGN KEY ("device") REFERENCES "public"."core_entity"("id") ON DELETE cascade ON UPDATE no action;
	END IF;
END $$;--> statement-breakpoint
DROP TABLE IF EXISTS "core_device_channel";--> statement-breakpoint
DROP TABLE IF EXISTS "core_device";

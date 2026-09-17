-- Rows sharing a Connection & external_id would block the unique index - the most recently updated row keeps the external_id
UPDATE "core_device" SET "external_id" = '' WHERE "id" IN (
	SELECT "id" FROM (
		SELECT "id", ROW_NUMBER() OVER (PARTITION BY "connection", "external_id" ORDER BY "updated" DESC, "id") AS "rank"
		FROM "core_device"
		WHERE "external_id" <> '' AND "connection" IS NOT NULL
	) "ranked" WHERE "rank" > 1
);--> statement-breakpoint
UPDATE "core_event" SET "external_id" = '' WHERE "id" IN (
	SELECT "id" FROM (
		SELECT "id", ROW_NUMBER() OVER (PARTITION BY "connection", "external_id" ORDER BY "updated" DESC, "id") AS "rank"
		FROM "core_event"
		WHERE "external_id" <> '' AND "connection" IS NOT NULL
	) "ranked" WHERE "rank" > 1
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "core_device_connection_external_id_idx" ON "core_device" USING btree ("connection","external_id") WHERE external_id <> '';--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "core_event_connection_external_id_idx" ON "core_event" USING btree ("connection","external_id") WHERE external_id <> '';

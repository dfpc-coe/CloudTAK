-- Duplicate default Mappings would block the unique index - the first created was the one applied so it is kept
DELETE FROM "layer_mapping" WHERE "id" IN (
	SELECT "id" FROM (
		SELECT "id", ROW_NUMBER() OVER (PARTITION BY "layer", "schema", "destination" ORDER BY "id") AS "rank"
		FROM "layer_mapping"
		WHERE "query" IS NULL
	) "ranked" WHERE "rank" > 1
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "layer_mapping_default_idx" ON "layer_mapping" USING btree ("layer","schema","destination") WHERE query IS NULL;

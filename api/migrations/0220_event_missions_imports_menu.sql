ALTER TABLE "core_entity_event" ADD COLUMN IF NOT EXISTS "missions" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
DO $$ BEGIN
	IF EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema = 'public' AND table_name = 'core_entity' AND column_name = 'mission_guid'
	) THEN
		-- The Mission name is not known to the database - it falls back to the GUID until the Event is next edited
		UPDATE "core_entity_event"
		SET "missions" = jsonb_build_array(jsonb_build_object('name', "core_entity"."mission_guid"::text, 'guid', "core_entity"."mission_guid"::text))
		FROM "core_entity"
		WHERE "core_entity"."id" = "core_entity_event"."id"
		AND "core_entity"."mission_guid" IS NOT NULL
		AND "core_entity_event"."missions" = '[]'::jsonb;
	END IF;
END $$;--> statement-breakpoint
ALTER TABLE "core_entity" DROP COLUMN IF EXISTS "mission_guid";--> statement-breakpoint
-- The Imports menu entry was removed from the web app - drop it from saved menu orders
UPDATE "profile_settings"
SET "value" = COALESCE((
	SELECT jsonb_agg(elem ORDER BY ord)
	FROM jsonb_array_elements("value"::jsonb) WITH ORDINALITY AS t(elem, ord)
	WHERE elem->>'key' IS DISTINCT FROM 'imports'
), '[]'::jsonb)::text
WHERE "key" = 'menu_order'
AND "value" LIKE '[%'
AND "value"::jsonb @> '[{"key": "imports"}]'::jsonb;

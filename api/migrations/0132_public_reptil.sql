UPDATE "layers_incoming"
    SET styles = (styles #>> '{}')::JSON
    WHERE jsonb_typeof("layers_incoming"."styles"::jsonb) = 'string';

UPDATE "layers_incoming"
    SET enabled_styles = True
    WHERE "layers_incoming"."styles"::jsonb = '{}'::jsonb;

UPDATE "layers_incoming"
    SET styles =  jsonb_set(styles::JSONB, '{stale}', to_jsonb("layers_incoming"."stale"));

ALTER TABLE "layers_incoming"
    DROP COLUMN IF EXISTS stale;

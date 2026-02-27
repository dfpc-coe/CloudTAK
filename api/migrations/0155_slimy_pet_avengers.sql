-- Custom SQL migration file, put your code below! --

-- Migrate layers_incoming.groups → styles.marti.dest
-- For each row with a non-empty groups array, build a marti.dest entry per
-- group and enable styles so the new routing config takes effect.

-- Step 1: un-stringify any styles value that was stored as a JSON string
--         (the app sometimes jsonb_stringify-encodes the object before saving)
UPDATE "layers_incoming"
    SET styles = (styles #>> '{}')::JSON
    WHERE jsonb_typeof("layers_incoming"."styles"::jsonb) = 'string';

-- Step 2: populate marti.dest from the groups array
UPDATE layers_incoming
SET
    styles = jsonb_set(
        jsonb_set(
            CASE
                WHEN jsonb_typeof(styles::jsonb) = 'object' THEN styles::jsonb
                ELSE '{}'::jsonb
            END,
            '{marti}',
            COALESCE(styles::jsonb -> 'marti', '{}'::jsonb),
            true
        ),
        '{marti,dest}',
        (
            SELECT jsonb_agg(jsonb_build_object('group', g))
            FROM unnest(groups) AS g
        ),
        true
    )::json,
    enabled_styles = true
WHERE array_length(groups, 1) > 0
    AND (styles::jsonb -> 'marti' -> 'dest') IS NULL;
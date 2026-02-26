-- Custom SQL migration file, put your code below! --

-- Migrate layers_incoming.groups → styles.marti.dest
-- For each row with a non-empty groups array, build a marti.dest entry per
-- group and enable styles so the new routing config takes effect.

UPDATE layers_incoming
SET
    styles = jsonb_set(
        jsonb_set(
            styles::jsonb,
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
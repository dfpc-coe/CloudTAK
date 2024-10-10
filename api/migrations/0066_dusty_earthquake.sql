-- Custom SQL migration file, put you code below! --
-- Fixes: https://github.com/drizzle-team/drizzle-orm/issues/724 --
UPDATE connection_sinks
    SET body = ((body #>> '{}')::jsonb);
UPDATE connection_sinks
    SET body = (body::JSONB || ('{"points":' || (body->'layer') || '}')::JSONB) - 'layer';


-- Custom SQL migration file, put you code below! --
UPDATE connection_sinks SET body = ((body #>> '{}')::jsonb);


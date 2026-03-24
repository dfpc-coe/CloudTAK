DO $$
DECLARE
	migration record;
BEGIN
	CREATE OR REPLACE FUNCTION pg_temp.try_parse_jsonb(input text)
	RETURNS jsonb
	LANGUAGE plpgsql
	AS $fn$
	BEGIN
		RETURN input::jsonb;
	EXCEPTION
		WHEN others THEN
			RETURN NULL;
	END;
	$fn$;

	FOR migration IN
		SELECT * FROM (VALUES
			('basemaps_source', 'auth', 'object', '{'),
			('basemaps_vector', 'styles', 'array', '['),
			('connections', 'auth', 'object', '{'),
			('connection_features', 'properties', 'object', '{'),
			('data', 'assets', 'array', '['),
			('fusion_type', 'schema', 'object', '{'),
			('iconsets', 'spritesheet_json', 'object', '{'),
			('imports', 'config', 'object', '{'),
			('layers_incoming', 'styles', 'object', '{'),
			('layers_incoming', 'environment', 'object', '{'),
			('layers_incoming', 'ephemeral', 'object', '{'),
			('layers_incoming', 'config', 'object', '{'),
			('layers_outgoing', 'filters', 'object', '{'),
			('layers_outgoing', 'environment', 'object', '{'),
			('layers_outgoing', 'ephemeral', 'object', '{'),
			('mission_template_log', 'schema', 'object', '{'),
			('palette_feature', 'style', 'object', '{'),
			('profile', 'auth', 'object', '{'),
			('profile', 'agency_admin', 'array', '['),
			('profile_features', 'properties', 'object', '{'),
			('profile_files', 'artifacts', 'array', '['),
			('profile_fusion', 'value', 'object', '{'),
			('profile_overlays', 'styles', 'array', '['),
			('server', 'auth', 'object', '{')
		) AS columns(table_name, column_name, expected_type, expected_prefix)
	LOOP
		IF EXISTS (
			SELECT 1
			FROM information_schema.columns
			WHERE table_schema = 'public'
			  AND table_name = migration.table_name
			  AND column_name = migration.column_name
			  AND data_type = 'jsonb'
		) THEN
			EXECUTE format(
				$update$
					WITH candidates AS (
						SELECT ctid, pg_temp.try_parse_jsonb(%1$I #>> '{}') AS parsed
						FROM %2$I.%3$I
						WHERE jsonb_typeof(%1$I) = 'string'
						  AND left(ltrim(%1$I #>> '{}'), 1) = %4$L
					)
					UPDATE %2$I.%3$I AS target
					SET %1$I = candidates.parsed
					FROM candidates
					WHERE target.ctid = candidates.ctid
					  AND candidates.parsed IS NOT NULL
					  AND jsonb_typeof(candidates.parsed) = %5$L
				$update$,
				migration.column_name,
				'public',
				migration.table_name,
				migration.expected_prefix,
				migration.expected_type
			);
		END IF;
	END LOOP;
END $$;--> statement-breakpoint
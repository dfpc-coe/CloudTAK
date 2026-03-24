DO $$
DECLARE
	migration record;
	column_type text;
BEGIN
	FOR migration IN
		SELECT * FROM (VALUES
			('basemaps_source', 'auth', '''{}''::jsonb'),
			('basemaps_vector', 'styles', '''[]''::jsonb'),
			('connections', 'auth', NULL),
			('connection_features', 'properties', '''{}''::jsonb'),
			('data', 'assets', '''["*"]''::jsonb'),
			('fusion_type', 'schema', NULL),
			('iconsets', 'spritesheet_json', NULL),
			('imports', 'config', '''{}''::jsonb'),
			('layers_incoming', 'styles', '''{}''::jsonb'),
			('layers_incoming', 'environment', '''{}''::jsonb'),
			('layers_incoming', 'ephemeral', '''{}''::jsonb'),
			('layers_incoming', 'config', '''{}''::jsonb'),
			('layers_outgoing', 'filters', '''{}''::jsonb'),
			('layers_outgoing', 'environment', '''{}''::jsonb'),
			('layers_outgoing', 'ephemeral', '''{}''::jsonb'),
			('mission_template_log', 'schema', NULL),
			('palette_feature', 'style', '''{}''::jsonb'),
			('profile', 'auth', NULL),
			('profile', 'agency_admin', '''[]''::jsonb'),
			('profile_features', 'properties', '''{}''::jsonb'),
			('profile_files', 'artifacts', '''[]''::jsonb'),
			('profile_fusion', 'value', '''{}''::jsonb'),
			('profile_overlays', 'styles', '''[]''::jsonb'),
			('server', 'auth', '''{}''::jsonb')
		) AS columns(table_name, column_name, default_expr)
	LOOP
		IF EXISTS (
			SELECT 1
			FROM information_schema.columns
			WHERE table_schema = 'public'
			  AND table_name = migration.table_name
			  AND column_name = migration.column_name
		) THEN
			SELECT data_type
			INTO column_type
			FROM information_schema.columns
			WHERE table_schema = 'public'
			  AND table_name = migration.table_name
			  AND column_name = migration.column_name;

			IF column_type IS DISTINCT FROM 'jsonb' THEN
				EXECUTE format(
					'ALTER TABLE %I.%I ALTER COLUMN %I SET DATA TYPE jsonb USING %I::jsonb',
					'public',
					migration.table_name,
					migration.column_name,
					migration.column_name
				);
			END IF;

			IF migration.default_expr IS NOT NULL THEN
				EXECUTE format(
					'ALTER TABLE %I.%I ALTER COLUMN %I SET DEFAULT %s',
					'public',
					migration.table_name,
					migration.column_name,
					migration.default_expr
				);
			END IF;
		END IF;
	END LOOP;
END $$;--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conrelid = 'public.connections'::REGCLASS
		AND conname = 'connections_name_unique'
	) THEN
		ALTER TABLE "connections" ADD CONSTRAINT "connections_name_unique" UNIQUE("name");
	END IF;
END $$;

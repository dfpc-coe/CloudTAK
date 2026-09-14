DO $$ BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema = 'public'
		AND table_name = 'layers_outgoing'
		AND column_name = 'subscriptions'
	) THEN
		ALTER TABLE "layers_outgoing" ADD COLUMN "subscriptions" text[] DEFAULT '{}' NOT NULL;
		UPDATE "layers_outgoing" SET "subscriptions" = '{feature:*}';
	END IF;
END $$;

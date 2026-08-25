UPDATE "layers" SET "permissions" = '{}' WHERE "permissions" IS NULL;
--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema = 'public'
		AND table_name = 'layers'
		AND column_name = 'permissions'
		AND column_default IS NOT NULL
	) THEN
		ALTER TABLE "layers" ALTER COLUMN "permissions" SET DEFAULT '{}';
	END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	IF EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema = 'public'
		AND table_name = 'layers'
		AND column_name = 'permissions'
		AND is_nullable = 'YES'
	) THEN
		ALTER TABLE "layers" ALTER COLUMN "permissions" SET NOT NULL;
	END IF;
END $$;

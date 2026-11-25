ALTER TABLE "plugin" ADD COLUMN IF NOT EXISTS "author" text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE "plugin" ADD COLUMN IF NOT EXISTS "license" text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE "plugin" ADD COLUMN IF NOT EXISTS "homepage" text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE "plugin" ADD COLUMN IF NOT EXISTS "logo" text;
--> statement-breakpoint
UPDATE "plugin" SET "name" = "name" || ' ' || "id"
	WHERE "id" IN (
		SELECT "id" FROM (
			SELECT "id", row_number() OVER (PARTITION BY "name" ORDER BY "created", "id") AS rn FROM "plugin"
		) AS ranked WHERE rn > 1
	);
--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'plugin_name_unique'
			AND conrelid = to_regclass('public.plugin')
	) THEN
		ALTER TABLE "plugin" ADD CONSTRAINT "plugin_name_unique" UNIQUE("name");
	END IF;
END $$;

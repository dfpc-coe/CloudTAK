DO $$ BEGIN
	IF to_regclass('public.tasks') IS NOT NULL AND to_regclass('public.integrations') IS NULL THEN
		ALTER TABLE "tasks" RENAME TO "integrations";
	END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
	IF EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'tasks_prefix_unique' AND conrelid = to_regclass('public.integrations')
	) THEN
		ALTER TABLE "integrations" RENAME CONSTRAINT "tasks_prefix_unique" TO "integrations_prefix_unique";
	END IF;
END $$;--> statement-breakpoint
ALTER SEQUENCE IF EXISTS "tasks_id_seq" RENAME TO "integrations_id_seq";--> statement-breakpoint
ALTER TABLE "layers" ADD COLUMN IF NOT EXISTS "version" text;--> statement-breakpoint
DO $$ BEGIN
	-- Only while "task" is still the versioned text slug; once it is the bigint FK the data has been migrated
	IF EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema = 'public' AND table_name = 'layers' AND column_name = 'task' AND data_type = 'text'
	) THEN
		UPDATE "layers" SET "version" = substring("task" from '-v([0-9]+\.[0-9]+\.[0-9]+)$') WHERE "version" IS NULL;

		INSERT INTO "integrations" ("name", "prefix")
			SELECT DISTINCT
				regexp_replace("task", '-v[0-9]+\.[0-9]+\.[0-9]+$', ''),
				regexp_replace("task", '-v[0-9]+\.[0-9]+\.[0-9]+$', '')
			FROM "layers"
			ON CONFLICT ("prefix") DO NOTHING;

		ALTER TABLE "layers" ADD COLUMN IF NOT EXISTS "integration" bigint;

		UPDATE "layers" SET "integration" = i.id
			FROM "integrations" i
			WHERE i.prefix = regexp_replace("layers"."task", '-v[0-9]+\.[0-9]+\.[0-9]+$', '');

		ALTER TABLE "layers" DROP COLUMN "task";
		ALTER TABLE "layers" RENAME COLUMN "integration" TO "task";
	END IF;
END $$;--> statement-breakpoint
ALTER TABLE "layers" ALTER COLUMN "task" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "layers" ALTER COLUMN "version" SET NOT NULL;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "layers" ADD CONSTRAINT "layers_task_integrations_id_fk" FOREIGN KEY ("task") REFERENCES "public"."integrations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

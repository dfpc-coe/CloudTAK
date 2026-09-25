ALTER TABLE "tasks" RENAME TO "integrations";--> statement-breakpoint
ALTER TABLE "integrations" RENAME CONSTRAINT "tasks_prefix_unique" TO "integrations_prefix_unique";--> statement-breakpoint
ALTER SEQUENCE IF EXISTS "tasks_id_seq" RENAME TO "integrations_id_seq";--> statement-breakpoint
ALTER TABLE "layers" ADD COLUMN "version" text;--> statement-breakpoint
UPDATE "layers" SET "version" = substring("task" from '-v([0-9]+\.[0-9]+\.[0-9]+)$');--> statement-breakpoint
INSERT INTO "integrations" ("name", "prefix")
	SELECT DISTINCT
		regexp_replace("task", '-v[0-9]+\.[0-9]+\.[0-9]+$', ''),
		regexp_replace("task", '-v[0-9]+\.[0-9]+\.[0-9]+$', '')
	FROM "layers"
	ON CONFLICT ("prefix") DO NOTHING;--> statement-breakpoint
ALTER TABLE "layers" ADD COLUMN "integration" bigint;--> statement-breakpoint
UPDATE "layers" SET "integration" = i.id
	FROM "integrations" i
	WHERE i.prefix = regexp_replace("layers"."task", '-v[0-9]+\.[0-9]+\.[0-9]+$', '');--> statement-breakpoint
ALTER TABLE "layers" DROP COLUMN "task";--> statement-breakpoint
ALTER TABLE "layers" RENAME COLUMN "integration" TO "task";--> statement-breakpoint
ALTER TABLE "layers" ALTER COLUMN "task" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "layers" ALTER COLUMN "version" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "layers" ADD CONSTRAINT "layers_task_integrations_id_fk" FOREIGN KEY ("task") REFERENCES "public"."integrations"("id") ON DELETE no action ON UPDATE no action;

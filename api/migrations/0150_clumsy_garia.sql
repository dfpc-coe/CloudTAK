CREATE TABLE IF NOT EXISTS "import_result" (
	"id" serial PRIMARY KEY NOT NULL,
	"import" text NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"type_id" text NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "import_result" ADD CONSTRAINT "import_result_import_imports_id_fk" FOREIGN KEY ("import") REFERENCES "public"."imports"("id") ON DELETE CASCADE ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "imports" DROP COLUMN IF EXISTS "result";
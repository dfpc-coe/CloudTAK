DO $$ BEGIN
 ALTER TABLE "mission_template_log" ALTER COLUMN "icon" DROP DEFAULT;
EXCEPTION
 WHEN undefined_column THEN null;
 WHEN undefined_table THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "mission_template_log" ALTER COLUMN "icon" DROP NOT NULL;
EXCEPTION
 WHEN undefined_column THEN null;
 WHEN undefined_table THEN null;
END $$;
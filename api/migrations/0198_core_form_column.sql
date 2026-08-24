CREATE TABLE IF NOT EXISTS "core_form_column" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created" timestamp with time zone DEFAULT Now() NOT NULL,
	"updated" timestamp with time zone DEFAULT Now() NOT NULL,
	"form" uuid NOT NULL,
	"column" uuid NOT NULL,
	"required" boolean DEFAULT false NOT NULL,
	CONSTRAINT "core_form_column_column_form_unique" UNIQUE("column","form")
);
--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conrelid = 'public.core_form_column'::REGCLASS
		AND conname = 'core_form_column_form_core_form_id_fk'
	) THEN
		ALTER TABLE "core_form_column" ADD CONSTRAINT "core_form_column_form_core_form_id_fk" FOREIGN KEY ("form") REFERENCES "public"."core_form"("id") ON DELETE cascade ON UPDATE no action;
	END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conrelid = 'public.core_form_column'::REGCLASS
		AND conname = 'core_form_column_column_core_event_board_column_id_fk'
	) THEN
		ALTER TABLE "core_form_column" ADD CONSTRAINT "core_form_column_column_core_event_board_column_id_fk" FOREIGN KEY ("column") REFERENCES "public"."core_event_board_column"("id") ON DELETE cascade ON UPDATE no action;
	END IF;
END $$;

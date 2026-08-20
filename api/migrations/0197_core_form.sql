CREATE TABLE "core_form" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created" timestamp with time zone DEFAULT Now() NOT NULL,
	"updated" timestamp with time zone DEFAULT Now() NOT NULL,
	"username" text,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"schema" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core_form_board" (
	"form" uuid NOT NULL,
	"board" uuid NOT NULL,
	CONSTRAINT "core_form_board_form_board_pk" PRIMARY KEY("form","board")
);
--> statement-breakpoint
ALTER TABLE "core_form" ADD CONSTRAINT "core_form_username_profile_username_fk" FOREIGN KEY ("username") REFERENCES "public"."profile"("username") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core_form_board" ADD CONSTRAINT "core_form_board_form_core_form_id_fk" FOREIGN KEY ("form") REFERENCES "public"."core_form"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core_form_board" ADD CONSTRAINT "core_form_board_board_core_event_board_id_fk" FOREIGN KEY ("board") REFERENCES "public"."core_event_board"("id") ON DELETE cascade ON UPDATE no action;
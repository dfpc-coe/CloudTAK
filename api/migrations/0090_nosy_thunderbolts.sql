CREATE TABLE "layers_outgoing" (
	"layer" integer PRIMARY KEY NOT NULL,
	"created" timestamp with time zone DEFAULT Now() NOT NULL,
	"updated" timestamp with time zone DEFAULT Now() NOT NULL,
	"environment" json DEFAULT '{}'::json NOT NULL,
	"ephemeral" json DEFAULT '{}'::json NOT NULL
);
--> statement-breakpoint
ALTER TABLE "layers_outgoing" ADD CONSTRAINT "layers_outgoing_layer_layers_id_fk" FOREIGN KEY ("layer") REFERENCES "public"."layers"("id") ON DELETE no action ON UPDATE no action;
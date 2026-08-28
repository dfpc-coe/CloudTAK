CREATE TABLE "layer_style" (
	"id" serial PRIMARY KEY NOT NULL,
	"created" timestamp with time zone DEFAULT Now() NOT NULL,
	"updated" timestamp with time zone DEFAULT Now() NOT NULL,
	"layer" integer NOT NULL,
	"target" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"style" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "layer_style_layer_target_unique" UNIQUE("layer","target")
);
--> statement-breakpoint
ALTER TABLE "layer_style" ADD CONSTRAINT "layer_style_layer_layers_incoming_layer_fk" FOREIGN KEY ("layer") REFERENCES "public"."layers_incoming"("layer") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
INSERT INTO "layer_style" ("layer", "target", "enabled", "style")
    SELECT "layer", 'feature', "enabled_styles", "styles"
    FROM "layers_incoming"
    WHERE "enabled_styles" = True OR "styles" <> '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "layers_incoming" DROP COLUMN "enabled_styles";--> statement-breakpoint
ALTER TABLE "layers_incoming" DROP COLUMN "styles";
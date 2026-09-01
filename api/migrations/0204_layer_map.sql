CREATE TABLE "layer_map" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created" timestamp with time zone DEFAULT Now() NOT NULL,
	"updated" timestamp with time zone DEFAULT Now() NOT NULL,
	"layer" integer NOT NULL,
	"name" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"query" text NOT NULL,
	"type" text NOT NULL,
	"mapping" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "layer_map" ADD CONSTRAINT "layer_map_layer_layers_id_fk" FOREIGN KEY ("layer") REFERENCES "public"."layers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "layer_map_layer_idx" ON "layer_map" USING btree ("layer");
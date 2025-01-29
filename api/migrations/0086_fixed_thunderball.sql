CREATE TABLE "layers_incoming" (
	"layer" integer
);
--> statement-breakpoint
ALTER TABLE "layers_incoming" ADD CONSTRAINT "layers_incoming_layer_layers_id_fk" FOREIGN KEY ("layer") REFERENCES "public"."layers"("id") ON DELETE no action ON UPDATE no action;
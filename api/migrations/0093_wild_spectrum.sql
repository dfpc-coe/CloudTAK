CREATE TABLE "video_lease_permission" (
	"id" serial PRIMARY KEY NOT NULL,
	"lease" text,
	"layer" integer
);
--> statement-breakpoint
ALTER TABLE "video_lease" ADD COLUMN "source_type" text DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE "video_lease" ADD COLUMN "source_model" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "video_lease_permission" ADD CONSTRAINT "video_lease_permission_lease_video_lease_id_fk" FOREIGN KEY ("lease") REFERENCES "public"."video_lease"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_lease_permission" ADD CONSTRAINT "video_lease_permission_layer_layers_id_fk" FOREIGN KEY ("layer") REFERENCES "public"."layers"("id") ON DELETE no action ON UPDATE no action;
CREATE TABLE "basemaps_collection" (
	"id" serial PRIMARY KEY NOT NULL,
	"created" timestamp with time zone DEFAULT Now() NOT NULL,
	"updated" timestamp with time zone DEFAULT Now() NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "basemaps" ADD COLUMN "collection" integer;--> statement-breakpoint
ALTER TABLE "basemaps" ADD CONSTRAINT "basemaps_collection_basemaps_collection_id_fk" FOREIGN KEY ("collection") REFERENCES "public"."basemaps_collection"("id") ON DELETE no action ON UPDATE no action;

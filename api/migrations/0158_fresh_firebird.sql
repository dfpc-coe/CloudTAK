CREATE TABLE IF NOT EXISTS "basemap_channels" (
    "basemap" integer NOT NULL,
    "channel" integer NOT NULL,
    CONSTRAINT "basemap_channels_basemap_channel_pk" PRIMARY KEY("basemap","channel")
);
--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'basemap_channels_basemap_basemaps_id_fk'
    ) THEN
        ALTER TABLE "basemap_channels" ADD CONSTRAINT "basemap_channels_basemap_basemaps_id_fk" FOREIGN KEY ("basemap") REFERENCES "public"."basemaps"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "basemap_channels_channel_idx" ON "basemap_channels" USING btree ("channel");

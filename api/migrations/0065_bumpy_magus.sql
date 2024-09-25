ALTER TABLE "basemaps" ADD COLUMN "overlay" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "basemaps" ADD COLUMN "styles" json DEFAULT '[]'::json NOT NULL;

INSERT INTO basemaps (
    style,
    overlay,
    name,
    created,
    updated,
    type,
    styles,
    url,
    minzoom,
    maxzoom,
    format
)
    SELECT
        'zxy' AS style,
        True AS overlay,
        name,
        created,
        updated,
        type,
        styles,
        url,
        minzoom,
        maxzoom,
        format
    FROM
        overlays;
    

DROP TABLE "overlays";--> statement-breakpoint

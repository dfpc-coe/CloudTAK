CREATE TABLE IF NOT EXISTS "profile_settings" (
    "username" text NOT NULL REFERENCES "profile"("username") ON DELETE CASCADE,
	"key" text NOT NULL,
	"value" text DEFAULT '' NOT NULL,
    "updated" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    PRIMARY KEY ("username", "key")
);

INSERT INTO "profile_settings" ("username", "key", "value")
SELECT "username", 'display::stale', "display_stale"::text FROM "profile" WHERE "display_stale" IS NOT NULL
UNION ALL
SELECT "username", 'display::distance', "display_distance"::text FROM "profile" WHERE "display_distance" IS NOT NULL
UNION ALL
SELECT "username", 'display::elevation', "display_elevation"::text FROM "profile" WHERE "display_elevation" IS NOT NULL
UNION ALL
SELECT "username", 'display::projection', "display_projection"::text FROM "profile" WHERE "display_projection" IS NOT NULL
UNION ALL
SELECT "username", 'display::speed', "display_speed"::text FROM "profile" WHERE "display_speed" IS NOT NULL
UNION ALL
SELECT "username", 'display::zoom', "display_zoom"::text FROM "profile" WHERE "display_zoom" IS NOT NULL
UNION ALL
SELECT "username", 'display::icon_rotation', "display_icon_rotation"::text FROM "profile" WHERE "display_icon_rotation" IS NOT NULL
UNION ALL
SELECT "username", 'display::text', "display_text"::text FROM "profile" WHERE "display_text" IS NOT NULL
UNION ALL
SELECT "username", 'tak::callsign', "tak_callsign"::text FROM "profile" WHERE "tak_callsign" IS NOT NULL
UNION ALL
SELECT "username", 'tak::remarks', "tak_remarks"::text FROM "profile" WHERE "tak_remarks" IS NOT NULL
UNION ALL
SELECT "username", 'tak::group', "tak_group"::text FROM "profile" WHERE "tak_group" IS NOT NULL
UNION ALL
SELECT "username", 'tak::type', "tak_type"::text FROM "profile" WHERE "tak_type" IS NOT NULL
UNION ALL
SELECT "username", 'tak::role', "tak_role"::text FROM "profile" WHERE "tak_role" IS NOT NULL
UNION ALL
SELECT "username", 'tak::loc_freq', "tak_loc_freq"::text FROM "profile" WHERE "tak_loc_freq" IS NOT NULL
UNION ALL
SELECT "username", 'tak::loc', ST_AsGeoJSON("tak_loc")::text FROM "profile" WHERE "tak_loc" IS NOT NULL;

ALTER TABLE "profile"
    DROP COLUMN IF EXISTS "display_stale",
    DROP COLUMN IF EXISTS "display_distance",
    DROP COLUMN IF EXISTS "display_elevation",
    DROP COLUMN IF EXISTS "display_projection",
    DROP COLUMN IF EXISTS "display_speed",
    DROP COLUMN IF EXISTS "display_zoom",
    DROP COLUMN IF EXISTS "display_icon_rotation",
    DROP COLUMN IF EXISTS "display_text",
    DROP COLUMN IF EXISTS "tak_callsign",
    DROP COLUMN IF EXISTS "tak_remarks",
    DROP COLUMN IF EXISTS "tak_group",
    DROP COLUMN IF EXISTS "tak_type",
    DROP COLUMN IF EXISTS "tak_role",
    DROP COLUMN IF EXISTS "tak_loc_freq",
    DROP COLUMN IF EXISTS "tak_loc";


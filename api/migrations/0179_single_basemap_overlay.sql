-- Remove all but one `mode: basemap` overlay for any given user.
-- Keeps the earliest (lowest id) basemap overlay per user and deletes the rest.
DELETE FROM "profile_overlays"
WHERE "id" IN (
    SELECT "id" FROM (
        SELECT
            "id",
            ROW_NUMBER() OVER (PARTITION BY "username" ORDER BY "id" ASC) AS rn
        FROM "profile_overlays"
        WHERE "mode" = 'basemap'
    ) ranked
    WHERE rn > 1
);

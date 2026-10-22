UPDATE profile_overlays SET pos = -1 WHERE mode = 'basemap';
--> statement-breakpoint
UPDATE profile_overlays p
    SET pos = r.rn
    FROM (
        SELECT id, row_number() OVER (PARTITION BY username ORDER BY pos, name, id) - 1 AS rn
        FROM profile_overlays
        WHERE mode != 'basemap'
    ) r
    WHERE p.id = r.id;

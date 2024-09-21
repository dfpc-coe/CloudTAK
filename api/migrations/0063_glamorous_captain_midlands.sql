UPDATE profile_overlays
    SET styles = '[]'::JSON
    WHERE
        styles IS NULL
        OR styles::TEXT = '"\"\""';

ALTER TABLE "profile_overlays" ALTER COLUMN "styles" SET DEFAULT '[]'::json;--> statement-breakpoint
ALTER TABLE "profile_overlays" ALTER COLUMN "styles" SET NOT NULL;

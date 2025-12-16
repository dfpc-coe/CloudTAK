ALTER TABLE "icons" ADD COLUMN "format" text;

UPDATE "icons"
    SET
        "format" = substring("name" from '\.[^.]+$'),
        "name" = regexp_replace("name", '\.[^.]+$', '');

ALTER TABLE "icons" ALTER COLUMN "format" SET NOT NULL;
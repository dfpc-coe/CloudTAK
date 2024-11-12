ALTER TABLE "server" ADD COLUMN "webtak" text DEFAULT '' NOT NULL;

UPDATE server
    SET webtak = Regexp_Replace(api, ':[0-9]+$', '')

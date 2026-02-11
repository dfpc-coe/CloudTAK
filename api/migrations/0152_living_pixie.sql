-- Custom SQL migration file, put your code below! --
INSERT INTO "settings" ("key", "value")
SELECT 'login::name', "name"
FROM "server"
ORDER BY "id" ASC
LIMIT 1
ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value";
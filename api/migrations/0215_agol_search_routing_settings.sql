-- ArcGIS Online credentials were shared by Search & Routing - each provider now has its own copy
WITH "legacy" AS (
	SELECT "key", "value"
	FROM "settings"
	WHERE "key" IN ('agol::auth_method', 'agol::token', 'agol::client_id', 'agol::client_secret')
), "configured" AS (
	SELECT (
		COALESCE((SELECT "value" FROM "legacy" WHERE "key" = 'agol::auth_method'), 'oauth2') = 'oauth2'
		AND COALESCE((SELECT "value" FROM "legacy" WHERE "key" = 'agol::client_id'), '') <> ''
		AND COALESCE((SELECT "value" FROM "legacy" WHERE "key" = 'agol::client_secret'), '') <> ''
	) OR (
		COALESCE((SELECT "value" FROM "legacy" WHERE "key" = 'agol::auth_method'), 'oauth2') <> 'oauth2'
		AND COALESCE((SELECT "value" FROM "legacy" WHERE "key" = 'agol::token'), '') <> ''
	) AS "enabled"
), "scopes" AS (
	SELECT "scope"
	FROM (VALUES ('search'), ('routing')) AS "scopes" ("scope")
	WHERE NOT EXISTS (
		SELECT 1 FROM "settings" WHERE starts_with("key", "scope" || '::agol::')
	)
)
INSERT INTO "settings" ("key", "value")
	SELECT "scope" || '::' || "key", "value" FROM "scopes", "legacy"
	UNION ALL
	SELECT "scope" || '::agol::enabled', 'true' FROM "scopes", "configured" WHERE "enabled"
ON CONFLICT ("key") DO NOTHING;--> statement-breakpoint
DELETE FROM "settings"
	WHERE "key" IN ('agol::enabled', 'agol::auth_method', 'agol::token', 'agol::client_id', 'agol::client_secret');

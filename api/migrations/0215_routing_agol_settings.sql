-- Routing previously shared the ArcGIS Online Search credentials - copy them so existing routing keeps working
INSERT INTO "settings" ("key", "value")
	SELECT 'routing::' || "key", "value"
	FROM "settings"
	WHERE "key" IN ('agol::auth_method', 'agol::token', 'agol::client_id', 'agol::client_secret')
ON CONFLICT ("key") DO NOTHING;--> statement-breakpoint
INSERT INTO "settings" ("key", "value")
	SELECT 'routing::agol::enabled', 'true'
	WHERE (
		COALESCE((SELECT "value" FROM "settings" WHERE "key" = 'agol::auth_method'), 'oauth2') = 'oauth2'
		AND COALESCE((SELECT "value" FROM "settings" WHERE "key" = 'agol::client_id'), '') <> ''
		AND COALESCE((SELECT "value" FROM "settings" WHERE "key" = 'agol::client_secret'), '') <> ''
	) OR (
		COALESCE((SELECT "value" FROM "settings" WHERE "key" = 'agol::auth_method'), 'oauth2') <> 'oauth2'
		AND COALESCE((SELECT "value" FROM "settings" WHERE "key" = 'agol::token'), '') <> ''
	)
ON CONFLICT ("key") DO NOTHING;

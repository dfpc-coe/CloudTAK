-- Add OAuth2 configuration settings for ArcGIS Online
INSERT INTO "settings" ("key", "value") VALUES ('agol::auth_method', 'oauth2') ON CONFLICT ("key") DO NOTHING;
INSERT INTO "settings" ("key", "value") VALUES ('agol::client_id', '') ON CONFLICT ("key") DO NOTHING;
INSERT INTO "settings" ("key", "value") VALUES ('agol::client_secret', '') ON CONFLICT ("key") DO NOTHING;
-- User pucks (TAK client self-position markers) were never meant to be saved
-- to a user's feature database. Remove any that were archived accidentally.
DELETE FROM "profile_features"
WHERE "properties" ? 'group'
   OR ("properties" ? 'takv' AND "properties"->'takv' <> '{}'::jsonb)
   OR "id" LIKE 'ANDROID-%';

-- User pucks (TAK client self-position markers) were never meant to be saved
-- to a user's feature database. Remove any that were archived accidentally.
-- Safe to re-run: the filtered DELETE matches nothing once they are gone.
DO $$ BEGIN
	IF to_regclass('public.profile_features') IS NOT NULL THEN
		DELETE FROM "profile_features"
		WHERE "properties" ? 'group'
		   OR ("properties" ? 'takv' AND "properties"->'takv' <> '{}'::jsonb)
		   OR "id" LIKE 'ANDROID-%';
	END IF;
END $$;
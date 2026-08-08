DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profile' AND column_name = 'phone') THEN
        INSERT INTO "profile_settings" ("username", "key", "value", "updated")
            SELECT "username", 'tak::phone', "phone", Now()
                FROM "profile"
                WHERE "phone" IS NOT NULL AND "phone" != ''
        ON CONFLICT ("username", "key") DO UPDATE SET "value" = EXCLUDED."value", "updated" = EXCLUDED."updated";

        ALTER TABLE "profile" DROP COLUMN "phone";
    END IF;
END $$;

INSERT INTO "profile_settings" ("username", "key", "value", "updated")
    SELECT "username", 'tak::phone', "phone", Now()
        FROM "profile"
        WHERE "phone" IS NOT NULL AND "phone" != ''
ON CONFLICT ("username", "key") DO UPDATE SET "value" = EXCLUDED."value", "updated" = EXCLUDED."updated";--> statement-breakpoint
ALTER TABLE "profile" DROP COLUMN "phone";
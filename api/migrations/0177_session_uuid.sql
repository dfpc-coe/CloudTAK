DO $$
BEGIN
    IF (SELECT data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profile_sessions' AND column_name = 'id') IS DISTINCT FROM 'uuid' THEN
        ALTER TABLE "profile_sessions" DROP CONSTRAINT "profile_sessions_pkey";
        ALTER TABLE "profile_sessions" DROP COLUMN "id";
        ALTER TABLE "profile_sessions" ADD COLUMN "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL;
    END IF;
END $$;

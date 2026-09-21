-- Foreign Keys onto profile.username were created by both drizzle-kit and hand written migrations
-- so their names are inconsistent - any existing constraint is dropped regardless of its name and
-- recreated as ON UPDATE CASCADE under the name drizzle-kit expects
DO $$
DECLARE
    tbl TEXT;
    fk TEXT;
BEGIN
    FOREACH tbl IN ARRAY ARRAY[
        'basemaps',
        'connections',
        'core_device',
        'core_event',
        'core_form',
        'core_form_response',
        'data',
        'errors',
        'iconsets',
        'imports',
        'layers',
        'profile_chatroom',
        'profile_chats',
        'profile_features',
        'profile_files',
        'profile_fusion',
        'profile_interests',
        'profile_overlays',
        'profile_paging',
        'profile_passkeys',
        'profile_sessions',
        'profile_settings',
        'profile_tokens',
        'profile_videos',
        'video_lease'
    ] LOOP
        FOR fk IN
            SELECT con.conname
            FROM pg_constraint con
            WHERE con.contype = 'f'
                AND con.conrelid = format('public.%I', tbl)::regclass
                AND con.confrelid = 'public.profile'::regclass
                AND con.conkey = ARRAY[(
                    SELECT attnum FROM pg_attribute
                    WHERE attrelid = con.conrelid AND attname = 'username'
                )]
        LOOP
            EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', tbl, fk);
        END LOOP;

        EXECUTE format(
            'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY ("username") REFERENCES public.profile("username") ON DELETE no action ON UPDATE cascade',
            tbl, tbl || '_username_profile_username_fk'
        );
    END LOOP;
END $$;

import { ref, computed } from 'vue';
import type { Ref } from 'vue';
import ProfileConfig from '../base/profile.ts';

type Accessible = {
    username: string | null;
    editable: boolean;
};

export type ProfileIdentity = {
    username?: string;
    system_admin?: boolean;
};

/**
 * The current user's identity for access checks - read from the locally
 * synced Profile, falling back to the API on standalone pages (Event Board)
 * that have no local sync
 */
export async function loadProfileIdentity(): Promise<ProfileIdentity> {
    const [username, systemAdmin] = await Promise.all([
        ProfileConfig.get('username'),
        ProfileConfig.get('system_admin'),
    ]);

    const identity: ProfileIdentity = {
        username: username?.value as string | undefined,
        system_admin: systemAdmin?.value as boolean | undefined,
    };

    if (identity.username) return identity;

    try {
        const fetched = await ProfileConfig.fetch();

        return {
            username: fetched.username,
            system_admin: fetched.system_admin,
        };
    } catch (err) {
        console.error('Failed to fetch Profile', err);
        return identity;
    }
}

/**
 * Who may change a Core Entity - the creator (or a System Admin) always can,
 * everyone else only while the creator leaves the editable flag set
 */
export function useEntityAccess<T extends Accessible>(entity: Ref<T | undefined>) {
    const profile = ref<ProfileIdentity>({});

    const is_creator = computed(() => {
        if (!entity.value) return false;
        return !!profile.value.system_admin
            || (!!entity.value.username && entity.value.username === profile.value.username);
    });

    const is_editable = computed(() => {
        if (!entity.value) return false;
        return is_creator.value || entity.value.editable;
    });

    async function load(): Promise<void> {
        profile.value = await loadProfileIdentity();
    }

    return { is_creator, is_editable, load };
}

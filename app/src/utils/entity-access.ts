import { ref, computed } from 'vue';
import type { Ref } from 'vue';
import ProfileConfig from '../base/profile.ts';

type Accessible = {
    username: string | null;
    editable: boolean;
};

/**
 * Who may change a Core Entity - the creator (or a System Admin) always can,
 * everyone else only while the creator leaves the editable flag set
 */
export function useEntityAccess<T extends Accessible>(entity: Ref<T | undefined>) {
    const profile = ref<{ username?: string, system_admin?: boolean }>({});

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
        const [username, systemAdmin] = await Promise.all([
            ProfileConfig.get('username'),
            ProfileConfig.get('system_admin'),
        ]);

        profile.value = {
            username: username?.value as string | undefined,
            system_admin: systemAdmin?.value as boolean | undefined,
        };

        // Standalone pages (Event Board) have no locally synced Profile - fall
        // back to the API so creator/editable checks still work there
        if (!profile.value.username) {
            try {
                const fetched = await ProfileConfig.fetch();

                profile.value = {
                    username: fetched.username,
                    system_admin: fetched.system_admin,
                };
            } catch (err) {
                console.error('Failed to fetch Profile', err);
            }
        }
    }

    return { is_creator, is_editable, load };
}

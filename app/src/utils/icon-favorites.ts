import { ref, onUnmounted } from 'vue';
import { db, liveQuery } from '../database.ts';
import Icon from '../base/icon.ts';
import ProfileConfig from '../base/profile.ts';

/** Uid of the virtual iconset made up of the user's favorite icons */
export const FAVORITES_UID = 'favorites';
export const FAVORITES_NAME = 'Favorites';

/**
 * The user's favorite icons as `<iconset uid>:<icon path>` keys, kept in the profile
 */
export function useIconFavorites() {
    const favorites = ref<string[]>([]);

    let resolve: () => void;
    const ready = new Promise<void>((res) => { resolve = res; });

    const subscription = liveQuery(() => db.profile.get('icon_favorites')).subscribe({
        next: (entry) => {
            favorites.value = Array.isArray(entry?.value) ? entry.value as string[] : [];
            resolve();
        },
        error: () => resolve()
    });

    onUnmounted(() => subscription.unsubscribe());

    function isFavorite(icon?: string): boolean {
        return !!icon && favorites.value.includes(Icon.key(icon));
    }

    async function toggle(icon: string): Promise<void> {
        const key = Icon.key(icon);
        const next = favorites.value.includes(key)
            ? await prune(favorites.value.filter((favorite) => favorite !== key))
            : [...await prune(favorites.value), key];

        await new ProfileConfig('icon_favorites', next).commit(next);
    }

    /** Drop favorites whose iconset is gone, or whose icon is missing from a fully cached iconset */
    async function prune(keys: string[]): Promise<string[]> {
        const synced = new Map<string, boolean>();
        for (const iconset of await db.iconset.toArray()) {
            synced.set(iconset.uid, iconset.icons_version !== undefined);
        }

        const cached = await db.icon.bulkGet(keys);

        return keys.filter((key, i) => {
            if (cached[i]) return true;

            const uid = Icon.parse(key)?.iconset;
            return !!uid && synced.get(uid) === false;
        });
    }

    return { favorites, ready, isFavorite, toggle };
}

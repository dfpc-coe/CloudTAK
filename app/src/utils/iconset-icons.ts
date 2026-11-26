import { ref, computed, watch, onUnmounted } from 'vue';
import Icon from '../base/icon.ts';
import Iconset from '../base/iconset.ts';
import { useIconFavorites, FAVORITES_UID, FAVORITES_NAME } from './icon-favorites.ts';
import type { DBIcon, DBIconset } from '../database.ts';

/**
 * Locally cached iconsets and the icons of the selected one, with an object
 * URL per icon, for icon pickers. The user's favorite icons are offered as a
 * leading virtual iconset
 */
export function useIconsetIcons() {
    const loading = ref({ sets: false, icons: false });
    const sets = ref<DBIconset[]>([]);
    const setUid = ref('');
    const icons = ref<DBIcon[]>([]);
    const urls = ref<Map<string, string>>(new Map());
    const filter = ref('');

    const { favorites, ready, isFavorite, toggle: toggleFavorite } = useIconFavorites();

    const options = computed<Array<{ uid: string, name: string }>>(() => {
        const real = sets.value.map((set) => ({ uid: set.uid, name: set.name }));
        if (!favorites.value.length) return real;
        return [{ uid: FAVORITES_UID, name: FAVORITES_NAME }, ...real];
    });

    const setNames = computed<string[]>(() => options.value.map((set) => set.name));
    const setName = computed<string>(() => options.value.find((set) => set.uid === setUid.value)?.name || '');

    const filtered = computed<DBIcon[]>(() => {
        const f = filter.value.trim().toLowerCase();
        if (!f) return icons.value;
        return icons.value.filter((icon) => icon.path.toLowerCase().includes(f));
    });

    onUnmounted(revoke);

    watch(favorites, async () => {
        if (setUid.value !== FAVORITES_UID) return;
        if (!favorites.value.length) setUid.value = sets.value[0]?.uid ?? '';
        await fetchIcons();
    });

    function revoke(): void {
        for (const url of urls.value.values()) URL.revokeObjectURL(url);
        urls.value = new Map();
    }

    function owner(icon?: string): string | undefined {
        const uid = icon ? Icon.parse(icon)?.iconset : undefined;
        return uid && sets.value.some((set) => set.uid === uid) ? uid : undefined;
    }

    /** Load the iconsets once, opening the one that owns `icon`, else the favorites, else the first */
    async function load(icon?: string): Promise<void> {
        if (sets.value.length) return;

        loading.value.sets = true;

        try {
            sets.value = await Iconset.list();
        } finally {
            loading.value.sets = false;
        }

        await ready;

        setUid.value = owner(icon)
            ?? (favorites.value.length ? FAVORITES_UID : sets.value[0]?.uid)
            ?? '';

        await fetchIcons();
    }

    /** Switch to the iconset that owns `icon` when it is a different, known one */
    async function follow(icon?: string): Promise<void> {
        const uid = owner(icon);
        if (!uid || uid === setUid.value) return;
        if (setUid.value === FAVORITES_UID && isFavorite(icon)) return;

        setUid.value = uid;
        await fetchIcons();
    }

    async function selectSet(name: string): Promise<void> {
        const set = options.value.find((set) => set.name === name);
        if (!set || set.uid === setUid.value) return;

        setUid.value = set.uid;
        await fetchIcons();
    }

    async function fetchIcons(): Promise<void> {
        if (!setUid.value) {
            revoke();
            icons.value = [];
            return;
        }

        loading.value.icons = true;

        try {
            const uid = setUid.value;
            const list = uid === FAVORITES_UID
                ? await Icon.many([...favorites.value])
                : await Icon.list(uid);
            if (uid !== setUid.value) return;

            revoke();

            const next = new Map<string, string>();
            for (const icon of list) next.set(icon.name, URL.createObjectURL(icon.data));

            icons.value = list;
            urls.value = next;
        } finally {
            loading.value.icons = false;
        }
    }

    return {
        loading, sets, setName, setNames, filter, filtered, urls, load, follow, selectSet,
        isFavorite, toggleFavorite
    };
}

import { ref, computed } from 'vue';
import type { WritableComputedRef } from 'vue';
import { useRoute, useRouter } from 'vue-router';

export type RouteTabOptions = {
    /** Path of the view without its tab segment */
    base: () => string;
    /** Tab values the view currently offers - a param outside them falls back to the default */
    tabs: () => Array<string>;
    /** Tab shown when the URL carries none */
    fallback: string;
    /** When the view is rendered outside its route (a modal) the tab is held locally instead */
    embedded?: () => boolean;
};

/**
 * Tab selection held in the route's optional `:tab` param so every tab has a
 * URL - the default tab is the bare path and changes replace history
 */
export function useRouteTab(options: RouteTabOptions): WritableComputedRef<string> {
    const route = useRoute();
    const router = useRouter();
    const local = ref(options.fallback);

    return computed({
        get: () => {
            if (options.embedded?.()) return local.value;

            const tab = String(route.params.tab || '');
            return options.tabs().includes(tab) ? tab : options.fallback;
        },
        set: (tab) => {
            if (options.embedded?.()) {
                local.value = tab;
                return;
            }

            const base = options.base();
            void router.replace(tab === options.fallback ? base : `${base}/${tab}`);
        }
    });
}

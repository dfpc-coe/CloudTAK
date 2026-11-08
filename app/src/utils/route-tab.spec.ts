import { reactive } from 'vue';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const route = reactive<{ params: Record<string, string> }>({ params: {} });
const replace = vi.fn();

vi.mock('vue-router', () => ({
    useRoute: () => route,
    useRouter: () => ({ replace }),
}));

import { useRouteTab } from './route-tab.ts';

function setup(embedded = false) {
    return useRouteTab({
        base: () => '/event/1',
        tabs: () => ['details', 'timeline'],
        fallback: 'details',
        embedded: () => embedded,
    });
}

describe('useRouteTab', () => {
    beforeEach(() => {
        route.params = {};
        replace.mockReset();
    });

    it('falls back to the default without a tab param', () => {
        expect(setup().value).toBe('details');
    });

    it('reads a known tab from the route', () => {
        route.params = { tab: 'timeline' };
        expect(setup().value).toBe('timeline');
    });

    it('falls back when the route names an unknown tab', () => {
        route.params = { tab: 'nope' };
        expect(setup().value).toBe('details');
    });

    it('replaces the route with the tab path', () => {
        setup().value = 'timeline';
        expect(replace).toHaveBeenCalledWith('/event/1/timeline');
    });

    it('replaces the route with the bare path for the default tab', () => {
        route.params = { tab: 'timeline' };
        setup().value = 'details';
        expect(replace).toHaveBeenCalledWith('/event/1');
    });

    it('holds the tab locally when embedded', () => {
        route.params = { tab: 'timeline' };
        const tab = setup(true);

        expect(tab.value).toBe('details');

        tab.value = 'timeline';

        expect(tab.value).toBe('timeline');
        expect(replace).not.toHaveBeenCalled();
    });
});

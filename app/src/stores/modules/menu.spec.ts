import { describe, it, expect, vi, beforeEach } from 'vitest';

const isNativePlatform = vi.fn(() => false);

vi.mock('../../utils/capacitor.ts', () => ({
    isNativePlatform: () => isNativePlatform()
}));

vi.mock('../../base/profile.ts', () => ({ default: { get: vi.fn() } }));
vi.mock('../../base/contact.ts', () => ({ default: {} }));
vi.mock('../../base/chatroom.ts', () => ({ default: {} }));

import MenuManager from './menu.ts';

describe('MenuManager.items', () => {
    beforeEach(() => {
        isNativePlatform.mockReturnValue(false);
    });

    it('includes external routes on the web', () => {
        const menu = new MenuManager({});
        menu.isSystemAdmin.value = true;

        expect(menu.items.value.map((i) => i.key)).toContain('server');
    });

    it('hides external routes on native platforms', () => {
        isNativePlatform.mockReturnValue(true);

        const menu = new MenuManager({});
        menu.isSystemAdmin.value = true;
        menu.addMenuItem({
            key: 'plugin-external',
            label: 'Plugin',
            route: '/plugin',
            routeExternal: true,
            tooltip: 'Plugin',
            icon: { render: () => null }
        });

        const keys = menu.items.value.map((i) => i.key);
        expect(keys).not.toContain('server');
        expect(keys).not.toContain('plugin-external');
        expect(keys).toContain('settings');
    });
});

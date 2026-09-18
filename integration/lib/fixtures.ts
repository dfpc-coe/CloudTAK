import { test as base, expect, type Page } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage.ts';
import { MapPage } from '../pages/MapPage.ts';
import { cloudtakUsername, cloudtakPassword } from './env.ts';

export async function skipPermissionsModal(page: Page): Promise<void> {
    const skip = page.getByRole('button', { name: 'Skip for now' });
    if (await skip.isVisible({ timeout: 1000 }).catch(() => false)) {
        await skip.click();
    }
}

type Fixtures = {
    loginPage: LoginPage;
    map: MapPage;
    authedMap: MapPage;
    pageErrors: Error[];
    readyMap: MapPage;
};

export const test = base.extend<Fixtures>({
    // Unauthenticated LoginPage, already on /login.
    loginPage: async ({ page }, use) => {
        const login = new LoginPage(page);
        await login.goto();
        await use(login);
    },

    // Bare MapPage for the current page (no navigation performed).
    map: async ({ page }, use) => {
        await use(new MapPage(page));
    },

    // Password login -> map loaded -> permissions modal skipped.
    authedMap: async ({ page }, use) => {
        const login = new LoginPage(page);
        await login.goto();
        await login.login(cloudtakUsername(), cloudtakPassword());
        const map = new MapPage(page);
        await map.waitUntilLoaded();
        await skipPermissionsModal(page);
        await use(map);
    },

    // Uncaught exceptions and unhandled rejections, collected from before the first navigation.
    pageErrors: async ({ page }, use) => {
        const errors: Error[] = [];
        page.on('pageerror', (err) => errors.push(err));
        await use(errors);
    },

    // Map opened from the saved storage state, loaded, permissions modal skipped, tiles idle.
    // Depends on pageErrors so the listener is attached before goto().
    readyMap: async ({ page, pageErrors: _pageErrors }, use) => {
        const map = new MapPage(page);
        await map.goto();
        await map.waitUntilLoaded();
        await skipPermissionsModal(page);
        await map.expectMapIdle();
        await use(map);
    },
});

export { expect };
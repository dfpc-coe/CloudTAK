import { test as base, expect, type Page } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage.ts';
import { MapPage } from '../pages/MapPage.ts';
import { cloudtakUsername, cloudtakPassword } from './env.ts';

export async function skipPermissionsModal(page: Page): Promise<void> {
    const skip = page.getByRole('button', { name: 'Skip for now' });
    if (await skip.isVisible({ timeout: 10_000 }).catch(() => false)) {
        await skip.click();
    }
}

type AuthFixtures = {
    loginPage: LoginPage;
    map: MapPage;
    authedMap: MapPage;
};

export const test = base.extend<AuthFixtures>({
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
});

export { expect };
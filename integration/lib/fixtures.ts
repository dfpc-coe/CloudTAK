import { test as base, expect, type Page } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage.ts';
import { MapPage } from '../pages/MapPage.ts';
import { MenuPackages } from '../pages/MenuPackages.ts';
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
    menuPackages: MenuPackages;
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

    // Data Packages menu panel
    menuPackages: async ({ page }, use) => {
        await use(new MenuPackages(page));
    },
});

// First-login onboarding (WarnConfiguration.vue): set the required callsign
// decline the location disclosure, then skip the permission requests
// Every step is optional
export async function completeFirstLoginSetup(page: Page, callsign: string): Promise<void> {
    const callsignInput = page.getByPlaceholder('Enter your callsign');
    if (await callsignInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        await callsignInput.fill(callsign);
        await page.getByRole('button', { name: 'Get Started' }).click();
    }

    const notNow = page.getByRole('button', { name: 'Not now' });
    if (await notNow.isVisible({ timeout: 2000 }).catch(() => false)) {
        await notNow.click();
    }

    await skipPermissionsModal(page);
}

export { expect };
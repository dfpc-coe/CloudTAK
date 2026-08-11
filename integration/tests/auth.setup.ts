import { test as setup } from '@playwright/test';
import { STORAGE_STATE } from '../playwright.config.ts';
import { LoginPage } from '../pages/LoginPage.ts';
import { cloudtakUsername, cloudtakPassword } from '../lib/env.ts';

/**
 * Authenticate once through the real login form and persist the resulting
 * session (CloudTAK stores its token in localStorage) for every other test.
 */
setup('authenticate', async ({ page }) => {
    const login = new LoginPage(page);

    await login.goto();
    await login.login(cloudtakUsername(), cloudtakPassword());

    await page.context().storageState({ path: STORAGE_STATE });
});

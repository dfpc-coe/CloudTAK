import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';

/**
 * Page Object for the CloudTAK Login view (/login)
 */
export class LoginPage {
    readonly page: Page;
    readonly username: Locator;
    readonly password: Locator;
    readonly signIn: Locator;

    constructor(page: Page) {
        this.page = page;
        this.username = page.locator('input[autocomplete="username webauthn"]');
        this.password = page.locator('input[type="password"]');
        this.signIn = page.getByRole('button', { name: 'Sign In', exact: true });
    }

    async goto(): Promise<void> {
        await this.page.goto('/login');
    }

    /**
     * Authenticate through the real login form, exactly as a user would,
     * and wait until the app has navigated away from /login.
     *
     * The SPA fetches brand configuration before rendering the form, so the
     * first visibility check gets a generous timeout.
     */
    async login(username: string, password: string): Promise<void> {
        await expect(this.username).toBeVisible({ timeout: 30_000 });

        await this.username.fill(username);
        await this.password.first().fill(password);
        await this.signIn.click();

        await this.page.waitForURL((url) => !url.pathname.startsWith('/login'));
    }
}

import type { Page } from '@playwright/test';
import { test, expect, skipPermissionsModal } from '../lib/fixtures.ts';
import { LoginPage } from '../pages/LoginPage.ts';
import { MapPage } from '../pages/MapPage.ts';
import { cloudtakUsername, cloudtakPassword } from '../lib/env.ts';

test.use({ storageState: { cookies: [], origins: [] } });

/**
 * The web client stores its JWT in IndexedDB (Dexie db "CloudTAK", table
 * "config", key "token" - see api/web/src/std.ts), not localStorage.
 */
async function getStoredToken(page: Page): Promise<string | undefined> {
    return page.evaluate(() => new Promise<string | undefined>((resolve) => {
        try {
            const open = indexedDB.open('CloudTAK');
            open.onerror = () => resolve(undefined);
            open.onsuccess = () => {
                try {
                    const req = open.result.transaction('config', 'readonly')
                        .objectStore('config').get('token');
                    req.onsuccess = () => resolve(req.result?.value);
                    req.onerror = () => resolve(undefined);
                } catch {
                    resolve(undefined);
                }
            };
        } catch {
            resolve(undefined);
        }
    }));
}

const passkeyButton = (page: Page) => page.getByRole('button', { name: 'Sign in with Passkey' });
const errorModal = (page: Page) => page.getByText('Website Error');

test.describe('Auth: smoke and happy path', () => {
    test('AUTH-01 login page loads with all controls', async ({ loginPage }) => {
        await expect(loginPage.username).toBeVisible({ timeout: 30_000 });
        await expect(loginPage.password).toBeVisible();
        await expect(loginPage.signIn).toBeVisible();
        await expect(loginPage.password).toHaveAttribute('type', 'password');
        // AUTH-06: passkey option is offered.
        await expect(passkeyButton(loginPage.page)).toBeVisible();
    });

    test('AUTH-02 valid credentials land on the map with a stored session', async ({ authedMap, page }) => {
        // authedMap already performed password login + map load + skip modal.
        // Client side: JWT persisted in IndexedDB.
        const token = await getStoredToken(page);
        expect(token, 'JWT should be stored in IndexedDB config table').toBeTruthy();

        // Server side: the API confirms this is a live session for our user.
        const res = await page.request.get('/api/login', {
            headers: { Authorization: `Bearer ${token}` },
        });
        expect(res.status()).toBe(200);
        expect((await res.json()).email).toBe(cloudtakUsername());
    });

    test('AUTH-03 session survives a page refresh', async ({ authedMap, page }) => {
        await page.reload();
        await authedMap.waitUntilLoaded();
        // Still authenticated: not bounced back to /login.
        expect(new URL(page.url()).pathname).not.toContain('/login');
    });

    test('AUTH-04 logout via the main menu returns to login', async ({ authedMap, page }) => {
        const login = new LoginPage(page);

        // Capture the token so we can check server-side revocation after.
        const token = await getStoredToken(page);
        expect(token, 'should be logged in before logout').toBeTruthy();

        await page.getByLabel('Open Menu').click();
        await page.getByTitle('Logout').click();

        await expect(login.password).toBeVisible({ timeout: 30_000 });
        expect(new URL(page.url()).pathname).toContain('/login');

        // Observed: logout is client-side only. After logout the UI returns to
        // the login page, but the JWT still validates server-side (GET
        // /api/login returns 200, not 401) until it expires (~16h per the
        // login route source). For a shared-device, public-safety context
        // this is worth confirming with the team: is server-side revocation
        // on logout intended? Until that's answered, we assert the ACTUAL
        // behavior (client cleared) rather than fail on an assumed contract.
        const res = await page.request.get('/api/login', {
            headers: { Authorization: `Bearer ${token}` },
        });
        expect(
            res.status(),
            'documenting observed behavior: token still valid server-side after logout',
        ).toBe(200);
    });

    test('AUTH-05 browser Back after login keeps the session (observed)', async ({ authedMap, page }) => {
        const token = await getStoredToken(page);
        expect(token, 'should be logged in before Back').toBeTruthy();

        await page.goBack();
        await page.waitForLoadState('networkidle');

        // The session must survive Back: the server still accepts the token.
        const res = await page.request.get('/api/login', {
            headers: { Authorization: `Bearer ${token}` },
        });
        expect(res.status(), 'session should still be valid after Back').toBe(200);
    });
});

test.describe('Auth: passkey enrollment and login', () => {
    /**
     * AUTH-07: full passkey lifecycle - enroll, sign in with it, remove it.
     *
     * Grounded in the CloudTAK source:
     * - Passkeys are gated by the server setting `passkey::enabled`; the
     *   "Sign in with Passkey" button only renders when it is on.
     * - Management UI: /menu/settings/passkeys (MenuSettingsPasskeys.vue).
     * - The app uses @simplewebauthn/browser (standard WebAuthn), so a
     *   Playwright CDP virtual authenticator drives both ceremonies.
     *
     * Sign-in note: the login username field carries
     * autocomplete="username webauthn", enabling WebAuthn conditional UI
     * (autofill). With the auto-approving virtual authenticator holding the
     * resident credential we just enrolled, the browser completes the passkey
     * assertion AUTOMATICALLY as the login page renders - no explicit click.
     * We verify sign-in by landing on the map, not by clicking the button
     * (which appears briefly then vanishes once login succeeds).
     *
     * Also: CloudTAK's logout is client-side only and the session is held in
     * memory (appStore + Capacitor's in-memory Preferences cache), so we
     * clear persisted storage AND hard-reload to get a truly logged-out app.
     *
     * CLEANUP IS MANDATORY: the server-side credential outlives the virtual
     * authenticator, so the test removes the QA-TEST passkey it created. This
     * test MUTATES the shared account - prefer a dedicated account long-term.
     */
    test('AUTH-07 enroll a passkey, sign in with it, remove it', async ({ authedMap, page }) => {
        const map = authedMap;
        const passkeyName = `QA-TEST-${Date.now()}`;

        // Auto-approving virtual authenticator (isUserVerified: true).
        const cdp = await page.context().newCDPSession(page);
        await cdp.send('WebAuthn.enable');
        const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', {
            options: {
                protocol: 'ctap2',
                transport: 'internal',
                hasResidentKey: true,
                hasUserVerification: true,
                isUserVerified: true,
                automaticPresenceSimulation: true,
            },
        });

        // 1. Navigate to Login Passkeys via the menu (direct URL nav proved
        // unreliable): hamburger -> Settings -> Login Passkeys.
        await page.getByLabel('Open Menu').click();
        await page.getByRole('menuitem').filter({ hasText: 'Settings' }).click();
        await page.getByText('Login Passkeys').click();

        // 2. Add a passkey: "New Passkey" (+) -> name input -> Create.
        await page.getByTitle('New Passkey').click();
        await page.getByPlaceholder('Passkey Name').fill(passkeyName);
        await page.getByRole('button', { name: 'Create' }).click();
        await expect(page.getByText(passkeyName)).toBeVisible({ timeout: 15_000 });

        // 3. Force a truly logged-out state (see header note), then let the
        // conditional-UI passkey sign-in complete automatically.
        await page.evaluate(() => {
            localStorage.clear();
            sessionStorage.clear();
            return new Promise<void>((resolve) => {
                try {
                    const del = indexedDB.deleteDatabase('CloudTAK');
                    del.onsuccess = () => resolve();
                    del.onerror = () => resolve();
                    del.onblocked = () => resolve();
                } catch {
                    resolve();
                }
            });
        });
        await page.goto('/login');
        await page.reload();
        await map.waitUntilLoaded();
        await skipPermissionsModal(page);

        // 4. Cleanup: remove the enrolled passkey (mandatory).
        await page.getByLabel('Open Menu').click();
        await page.getByRole('menuitem').filter({ hasText: 'Settings' }).click();
        await page.getByText('Login Passkeys').click();
        // open Passkey Details
        await page.getByText(passkeyName).click();
        await page.getByTitle('Delete').click();
        // Confirm in the "Deletion Confirmation" modal
        await page.locator('.btn-danger').filter({ hasText: 'Delete' }).click();
        await expect(page.getByText(passkeyName)).toBeHidden({ timeout: 15_000 });

        await cdp.send('WebAuthn.removeVirtualAuthenticator', { authenticatorId });
    });
});

test.describe('Auth: validation and negatives', () => {
    test('AUTH-08 empty username is rejected with an error', async ({ loginPage }) => {
        // Observed: the app does not validate empty fields client-side - it
        // posts to the auth server and surfaces the "Website Error" modal.
        await expect(loginPage.username).toBeVisible({ timeout: 30_000 });

        await loginPage.password.fill('some-password');
        await loginPage.signIn.click();

        await expect(errorModal(loginPage.page)).toBeVisible({ timeout: 10_000 });
        expect(new URL(loginPage.page.url()).pathname).toContain('/login');
    });

    test('AUTH-09 empty password is rejected with an error', async ({ loginPage }) => {
        await expect(loginPage.username).toBeVisible({ timeout: 30_000 });

        await loginPage.username.fill(cloudtakUsername());
        await loginPage.signIn.click();

        await expect(errorModal(loginPage.page)).toBeVisible({ timeout: 10_000 });
        expect(new URL(loginPage.page.url()).pathname).toContain('/login');
    });

    test('AUTH-10 both fields empty is rejected with an error', async ({ loginPage }) => {
        await expect(loginPage.username).toBeVisible({ timeout: 30_000 });

        await loginPage.signIn.click();

        await expect(errorModal(loginPage.page)).toBeVisible({ timeout: 10_000 });
        expect(new URL(loginPage.page.url()).pathname).toContain('/login');
    });

    test('AUTH-11 wrong password shows an error and creates no session', async ({ loginPage }) => {
        const page = loginPage.page;
        await expect(loginPage.username).toBeVisible({ timeout: 30_000 });

        const responsePromise = page.waitForResponse((r) =>
            r.request().method() === 'POST' && new URL(r.url()).pathname.endsWith('/api/login'));

        await loginPage.username.fill(cloudtakUsername());
        await loginPage.password.fill(`wrong-${Date.now()}`);
        await loginPage.signIn.click();

        // Server side: rejected, no token returned.
        const response = await responsePromise;
        expect(response.status()).toBeGreaterThanOrEqual(400);
        expect((await response.json().catch(() => ({}))).token).toBeUndefined();

        expect(new URL(page.url()).pathname).toContain('/login');
        await expect(errorModal(page)).toBeVisible({ timeout: 10_000 });
    });

    test('AUTH-12 unknown user shows an error and creates no session', async ({ loginPage }) => {
        const page = loginPage.page;
        await expect(loginPage.username).toBeVisible({ timeout: 30_000 });

        const responsePromise = page.waitForResponse((r) =>
            r.request().method() === 'POST' && new URL(r.url()).pathname.endsWith('/api/login'));

        await loginPage.username.fill(`qa-unknown-${Date.now()}@example.com`);
        await loginPage.password.fill('irrelevant-password');
        await loginPage.signIn.click();

        const response = await responsePromise;
        expect(response.status()).toBeGreaterThanOrEqual(400);
        expect((await response.json().catch(() => ({}))).token).toBeUndefined();

        expect(new URL(page.url()).pathname).toContain('/login');
        await expect(errorModal(page)).toBeVisible({ timeout: 10_000 });
    });

    test('AUTH-13 password show/hide toggle reveals and masks the input', async ({ loginPage }) => {
        const page = loginPage.page;
        await expect(loginPage.password).toBeVisible({ timeout: 30_000 });

        // Target the field by placeholder, not by type: the toggle flips the
        // field's type between "password" and "text", so a type-based locator
        // stops matching after the first click.
        const field = page.getByPlaceholder('Your password');
        await field.fill('visible-check');
        await expect(field).toHaveAttribute('type', 'password');

        // The eye control is an <a aria-label="Show Password"> that flips its
        // label to "Hide Password" once shown.
        await page.getByRole('link', { name: 'Show Password' }).click();
        await expect(field).toHaveAttribute('type', 'text');

        await page.getByRole('link', { name: 'Hide Password' }).click();
        await expect(field).toHaveAttribute('type', 'password');
    });

    test('AUTH-15 failed passkey attempt shows a dismissible error, password login still works', async ({ loginPage }) => {
        // A virtual authenticator with isUserVerified:false rejects the
        // ceremony the same way a user pressing Cancel does. In Login.vue,
        // authenticatePasskey() re-throws that rejection, which surfaces the
        // "Website Error" modal. Chromium only.
        const page = loginPage.page;
        await expect(loginPage.username).toBeVisible({ timeout: 30_000 });

        const cdp = await page.context().newCDPSession(page);
        await cdp.send('WebAuthn.enable');
        await cdp.send('WebAuthn.addVirtualAuthenticator', {
            options: {
                protocol: 'ctap2',
                transport: 'internal',
                hasResidentKey: true,
                hasUserVerification: true,
                isUserVerified: false,       // ceremony will be rejected
                automaticPresenceSimulation: true,
            },
        });

        await passkeyButton(page).click();

        // The rejection surfaces the "Website Error" modal.
        await expect(errorModal(page)).toBeVisible({ timeout: 15_000 });

        // Dismiss it (OK control in the modal footer).
        await page.getByText('OK', { exact: true }).click();
        await expect(errorModal(page)).toBeHidden();

        // The failure must not wedge the page: password login still works.
        await loginPage.login(cloudtakUsername(), cloudtakPassword());
        await new MapPage(page).waitUntilLoaded();
    });
});

test.describe('Auth: access control', () => {
    test('AUTH-16 direct map access while logged out redirects to login', async ({ page }) => {
        await page.goto('/');
        // No session -> the app should send us to /login.
        await expect(new LoginPage(page).username).toBeVisible({ timeout: 30_000 });
        expect(new URL(page.url()).pathname).toContain('/login');
    });

    test('AUTH-17 browser Back after logout does not show the map', async ({ authedMap, page }) => {
        const login = new LoginPage(page);

        await page.getByLabel('Open Menu').click();
        await page.getByTitle('Logout').click();
        await expect(login.password).toBeVisible({ timeout: 30_000 });

        // Press Back: the authenticated map must NOT be restored from history.
        // (Note: logout is client-side only per AUTH-04, so this checks the
        // client protection - a bystander pressing Back on the device should
        // not land back on the map.)
        await page.goBack();
        await page.waitForLoadState('networkidle');

        // Still on login, no map canvas exposed.
        await expect(login.password).toBeVisible({ timeout: 30_000 });
        expect(new URL(page.url()).pathname).toContain('/login');
        await expect(authedMap.canvas.first()).toBeHidden();
    });

    test('AUTH-18 corrupted token invalidates the session on reload', async ({ authedMap, page }) => {
        const login = new LoginPage(page);

        // The web client reads its token from Capacitor Preferences (backed
        // by localStorage on web) as the primary source, with an IndexedDB
        // copy used inside web workers (see api/web/src/std.ts
        // getRuntimeToken). Corrupt BOTH so the app cannot fall back to a
        // good copy, then reload: the app must reject the bad token and
        // require login again.
        await page.evaluate(() => {
            for (const k of Object.keys(localStorage)) {
                if (/token/i.test(k)) localStorage.setItem(k, 'corrupted-token');
            }
            return new Promise<void>((resolve) => {
                try {
                    const open = indexedDB.open('CloudTAK');
                    open.onerror = () => resolve();
                    open.onsuccess = () => {
                        try {
                            const tx = open.result.transaction('config', 'readwrite');
                            tx.objectStore('config').put({ key: 'token', value: 'corrupted-token' });
                            tx.oncomplete = () => resolve();
                            tx.onerror = () => resolve();
                        } catch {
                            resolve();
                        }
                    };
                } catch {
                    resolve();
                }
            });
        });
        await page.reload();

        // App must send us back to login rather than trust the bad token.
        // Assert via the password field + Sign In button, which are present
        // in BOTH login states - the fresh form and the "returning user"
        // variant (which pre-fills the email, shows a "Not Me" button, and
        // omits the username field).
        await expect(login.password).toBeVisible({ timeout: 30_000 });
        await expect(login.signIn).toBeVisible();
        expect(new URL(page.url()).pathname).toContain('/login');

        // Server side: the corrupted token is rejected outright.
        const res = await page.request.get('/api/login', {
            headers: { Authorization: 'Bearer corrupted-token' },
        });
        expect(res.status()).toBe(401);
    });

    test('AUTH-19 issued token is configured to expire (~16h)', async ({ authedMap, page }) => {
        // Full "session expires mid-map, graceful re-auth prompt" behavior
        // can't be exercised without either waiting 16h or forging an expired
        // token signed with the server secret (not available to tests). What
        // we CAN verify without waiting: the issued JWT carries an `exp` claim
        // set ~16h out (login route signs with expiresIn: '16h'). The app's
        // reaction to an already-invalid token is covered by AUTH-18, since an
        // expired token fails jwt.verify() on the same path as a corrupted one.
        const token = await getStoredToken(page);
        expect(token, 'should have a token after login').toBeTruthy();

        // A JWT is three base64url segments: header.payload.signature. The
        // payload is readable without the signing secret (we only READ it, we
        // do not trust it) - decode it to inspect the exp/iat claims.
        const parts = (token as string).split('.');
        expect(parts.length, 'token should be a JWT (3 segments)').toBe(3);

        const payloadSegment = parts[1];
        expect(payloadSegment, 'JWT payload segment should exist').toBeTruthy();

        const payload = JSON.parse(
            Buffer.from(payloadSegment as string, 'base64url').toString('utf8'),
        ) as { exp?: number; iat?: number; email?: string };

        expect(payload.exp, 'JWT should carry an exp claim').toBeTruthy();
        expect(payload.iat, 'JWT should carry an iat claim').toBeTruthy();

        // exp - iat should be ~16 hours (57600s). Allow a minute of slack.
        const lifetimeSeconds = (payload.exp as number) - (payload.iat as number);
        expect(lifetimeSeconds).toBeGreaterThan(16 * 3600 - 60);
        expect(lifetimeSeconds).toBeLessThan(16 * 3600 + 60);

        // And exp should be in the future for a freshly issued token.
        expect((payload.exp as number) * 1000).toBeGreaterThan(Date.now());
    });
});
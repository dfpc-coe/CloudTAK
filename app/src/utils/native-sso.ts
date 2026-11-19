/**
 * TAK-NZ: SSO login for the native (Capacitor) app.
 *
 * The bundled app and the CloudTAK server are different origins, so the web
 * flow (navigate to /api/login/oidc, land back on /login#sso=...) cannot work
 * inside the app's WebView. Instead the login runs in the system browser and
 * hands control back through the app's URL scheme:
 *
 *   1. the app makes a random `verifier` and sends only its SHA-256 (the
 *      `app_challenge`) to GET /api/login/oidc, and keeps the verifier locally
 *   2. after the IdP login the server returns to `nz.tak.app://login?code=...`
 *   3. the app redeems the code at POST /api/login/oidc/exchange together with
 *      the verifier, which is what makes an intercepted code worthless
 *
 * See api/stateless/routes/login.ts.
 */
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Preferences } from '@capacitor/preferences';
import { stdurl } from '../std.ts';
import { isNativePlatform } from './capacitor.ts';

/** Must match the `custom_url_scheme` Android string and the iOS CFBundleURLSchemes */
export const APP_SCHEME = 'nz.tak.app';

const PENDING_KEY = 'ssoPending';

export type SSOCallback = { code: string } | { error: string };

export type NativeSSOLogin = {
    token: string;
    refresh: string;
    email: string;
    session: string;
};

type Pending = { verifier: string; redirect: string };

export function base64url(bytes: Uint8Array): string {
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** A random verifier and its base64url SHA-256 challenge */
export async function createChallenge(): Promise<{ verifier: string; challenge: string }> {
    const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
    return { verifier, challenge: base64url(new Uint8Array(digest)) };
}

/** Parse `nz.tak.app://login?code=...` or `...?sso_error=...`. Anything else is not ours */
export function parseSSOCallback(raw: string): SSOCallback | null {
    let url: URL;
    try {
        url = new URL(raw);
    } catch {
        return null;
    }
    if (url.protocol !== `${APP_SCHEME}:` || url.hostname !== 'login') return null;
    const error = url.searchParams.get('sso_error');
    if (error) return { error };
    const code = url.searchParams.get('code');
    if (code) return { code };
    return null;
}

async function readPending(): Promise<Pending | null> {
    const { value } = await Preferences.get({ key: PENDING_KEY });
    if (!value) return null;
    try {
        const pending = JSON.parse(value) as Pending;
        return typeof pending.verifier === 'string' ? pending : null;
    } catch {
        return null;
    }
}

/** Open the IdP login in the system browser. Resolves once the browser is shown */
export async function startNativeSSO(redirect: string): Promise<void> {
    const { verifier, challenge } = await createChallenge();
    // Kept in Preferences, not memory: Android may recreate the app while the browser is open
    await Preferences.set({ key: PENDING_KEY, value: JSON.stringify({ verifier, redirect } satisfies Pending) });

    const url = stdurl('/api/login/oidc');
    url.searchParams.set('app_challenge', challenge);
    url.searchParams.set('redirect', redirect);
    await Browser.open({ url: url.toString() });
}

/**
 * Redeem the code from the callback. Returns null when no login is pending
 * (for example the same URL delivered twice), which callers should ignore
 */
export async function completeNativeSSO(code: string): Promise<{ login: NativeSSOLogin; redirect: string } | null> {
    const pending = await readPending();
    if (!pending) return null;
    // One attempt only: a failed or repeated redemption must start over
    await Preferences.remove({ key: PENDING_KEY });

    const res = await fetch(stdurl('/api/login/oidc/exchange'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, verifier: pending.verifier }),
    });
    const body = await res.json().catch(() => ({})) as Partial<NativeSSOLogin> & { message?: string };
    if (!res.ok) throw new Error(body.message || 'SSO login failed - please try again');
    if (!body.token || !body.refresh || !body.email || !body.session) {
        throw new Error('SSO login failed - the server returned an incomplete session');
    }

    return {
        login: { token: body.token, refresh: body.refresh, email: body.email, session: body.session },
        redirect: pending.redirect,
    };
}

/** Clear a login that was started but never completed (user closed the browser) */
export async function cancelNativeSSO(): Promise<void> {
    await Preferences.remove({ key: PENDING_KEY });
}

export async function closeSSOBrowser(): Promise<void> {
    try {
        await Browser.close();
    } catch {
        // Not open (Android Custom Tabs cannot be closed programmatically)
    }
}

/**
 * Listen for the app being reopened through its URL scheme, including a cold
 * start from it. Returns a function that removes the listener
 */
export async function listenForSSOCallback(handler: (callback: SSOCallback) => void): Promise<() => void> {
    const listener = await App.addListener('appUrlOpen', (event) => {
        const callback = parseSSOCallback(event.url);
        if (callback) handler(callback);
    });

    // Cold start: the app may have been launched by the callback URL itself.
    // Only act on it while a login is pending, as the launch URL is not cleared
    if (await readPending()) {
        const launch = await App.getLaunchUrl();
        const callback = launch?.url ? parseSSOCallback(launch.url) : null;
        if (callback) handler(callback);
    }

    return () => { void listener.remove(); };
}

/**
 * Sign out of the identity provider as well as the app. On the web that is a
 * redirect to /api/logout. In the app, /api/logout has to run in the system
 * browser (where the IdP session lives) and the app returns to its own login
 * page, flagged so that forced SSO does not sign straight back in
 */
export async function ssoLogoutRedirect(): Promise<void> {
    if (!isNativePlatform()) {
        window.location.href = '/api/logout';
        return;
    }
    try {
        await Browser.open({ url: stdurl('/api/logout').toString() });
    } catch (err) {
        console.warn('Failed to open the SSO logout page', err);
    }
    window.location.href = '/login?signed_out=1';
}

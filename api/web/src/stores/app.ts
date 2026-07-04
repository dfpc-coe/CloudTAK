import { defineStore } from 'pinia';
import { liveQuery, type Subscription } from 'dexie';
import { Preferences } from '@capacitor/preferences';
import { StatusBar } from '@capacitor/status-bar';
import KV from '../base/kv.ts';
import { db, withDbRetry } from '../database.ts';
import { withTimeout } from '../base/async.ts';
import Config from '../base/config.ts';
import ServerManager from '../base/server.ts';
import router from '../router.ts';
import { isNativePlatform } from '../base/capacitor.ts';

export type DisplayStyleMode = 'System Default' | 'Light' | 'Dark';
export type ResolvedThemeMode = 'light' | 'dark';

// IndexedDB and network steps during bootstrap are bounded so a hung
// operation can never strand the user on the loading splash.
const BOOT_LOCAL_TIMEOUT_MS = 2000;
const BOOT_NETWORK_TIMEOUT_MS = 10000;

// Kept outside Pinia state so Vue does not attempt to proxy them.
let displayStyleSub: Subscription | undefined;
let brandingSub: Subscription | undefined;

const BRANDING_CONFIG_KEYS = [
    'login::name',
    'login::logo',
    'login::brand::enabled',
    'login::brand::logo',
    'login::background::enabled',
    'login::background::color',
    'login::signup',
    'login::forgot',
    'login::username'
] as const;
const systemThemeQuery = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : undefined;

function resolveTheme(style: string | undefined): ResolvedThemeMode {
    if (style === 'Light') return 'light';
    if (style === 'Dark') return 'dark';
    return systemThemeQuery?.matches ? 'dark' : 'light';
}

function handleSystemThemeChange(): void {
    const store = useAppStore();
    if (store.displayStyle === 'System Default') {
        store.applyTheme();
    }
}

export const useAppStore = defineStore('cloudtak-app', {
    state: (): {
        tokenExpiry: number | null;
        user: boolean;
        isMobileDetected: boolean;
        loginLogo: string | undefined;
        loginName: string | undefined;
        displayStyle: DisplayStyleMode;
        resolvedTheme: ResolvedThemeMode;
        loading: boolean;
        loadingStage: string;
    } => ({
        tokenExpiry: null,
        user: false,
        isMobileDetected: false,
        loginLogo: undefined,
        loginName: undefined,
        displayStyle: 'System Default',
        resolvedTheme: 'dark',
        loading: true,
        loadingStage: '',
    }),
    actions: {
        async setServerUrl(serverUrl: string): Promise<void> {
            await Preferences.set({ key: 'serverUrl', value: serverUrl });
            await this.mirrorServerUrl(serverUrl);
        },

        // Best-effort KV copy for web workers; must not block boot.
        async mirrorServerUrl(serverUrl: string): Promise<void> {
            try {
                await withTimeout(
                    withDbRetry(() => KV.generate('serverUrl', serverUrl)),
                    BOOT_LOCAL_TIMEOUT_MS,
                    'serverUrl KV mirror'
                );
            } catch (err) {
                console.warn('Failed to mirror serverUrl into KV store', err);
            }
        },

        async persistSession(opts: { token: string; username: string; session: string }): Promise<void> {
            await Preferences.set({ key: 'token', value: opts.token });
            await KV.generate('token', opts.token);
            await KV.generate('username', opts.username);

            await Preferences.set({
                key: 'sessionId',
                value: opts.session
            });

            await KV.generate('sessionId', opts.session);
        },

        async getSessionId(): Promise<string | undefined> {
            const { value } = await Preferences.get({ key: 'sessionId' });
            return value ?? undefined;
        },

        async getUsername(): Promise<string | undefined> {
            return await KV.value('username');
        },

        // Best-effort — the server enforces token expiry, so a stalled
        // cleanup is abandoned rather than allowed to hang logout or boot.
        async clearSession(): Promise<void> {
            try {
                await withTimeout(Promise.all([
                    Preferences.remove({ key: 'token' }),
                    Preferences.remove({ key: 'sessionId' }),
                    KV.delete('token'),
                    KV.delete('sessionId')
                ]), BOOT_LOCAL_TIMEOUT_MS, 'Session cleanup');
            } catch (err) {
                console.warn('Session cleanup did not complete', err);
            }
        },

        async destroySession(): Promise<void> {
            await this.clearSession();
            await db.delete();
            await db.open();
        },

        applyTheme(style?: string): void {
            const theme = resolveTheme(style ?? this.displayStyle);
            this.resolvedTheme = theme;

            document.documentElement.setAttribute('data-bs-theme', theme);
            document.documentElement.setAttribute('data-bs-theme-base', 'neutral');
            document.documentElement.setAttribute('data-bs-theme-primary', 'blue');
        },

        // Boot paths must await this: if bootstrap settles before the login
        // navigation lands, the router view mounts the map — and the Atlas
        // worker — without a session.
        async routeLogin(): Promise<void> {
            const redirect = encodeURIComponent(window.location.pathname);
            if (router.hasRoute('login')) {
                await router.push(`/login?redirect=${redirect}`);
            } else {
                window.location.href = `/login?redirect=${redirect}`;
            }
        },

        async refreshLogin(): Promise<void> {
            this.loading = true;

            try {
                const { value: token } = await Preferences.get({ key: 'token' });
                if (!token) throw new Error('No token found');
                const payload = JSON.parse(atob(token.split('.')[1]));
                const expirationDate = payload.exp * 1000;
                this.tokenExpiry = expirationDate;

                if (Date.now() > expirationDate) {
                    throw new Error('Token expired');
                }

                this.user = true;
            } catch (err) {
                console.error(err);
                this.tokenExpiry = null;

                await this.clearSession();
                await this.routeLogin();
            } finally {
                this.loading = false;
            }
        },

        async logout(): Promise<void> {
            this.user = false;
            this.tokenExpiry = null;
            await this.destroySession();
            window.location.href = '/login';
        },

        async bootstrap(): Promise<boolean> {
            this.loadingStage = 'Connecting to server…';

            if (!isNativePlatform()) {
                await this.setServerUrl(window.location.origin);
            } else {
                const { value } = await Preferences.get({ key: 'serverUrl' });
                const serverUrl = value?.trim();

                if (!serverUrl) {
                    window.location.href = '/setup.html';
                    return false;
                }

                await this.mirrorServerUrl(serverUrl);
            }

            this.loadingStage = 'Setting up styles…';

            if (isNativePlatform()) {
                try {
                    await StatusBar.setOverlaysWebView({ overlay: false });
                } catch (err) {
                    console.warn('Failed to configure native status bar overlay', err);
                }
            }

            this.applyTheme();

            displayStyleSub = liveQuery(() => db.profile.get('display_style')).subscribe((entry) => {
                const style = entry?.value;
                this.displayStyle = style === 'Light' || style === 'Dark' ? style : 'System Default';
                this.applyTheme(this.displayStyle);
            });

            systemThemeQuery?.addEventListener('change', handleSystemThemeChange);

            // Branding is cosmetic and must never block boot: paint cached or
            // default values now, refresh in the background.
            brandingSub = liveQuery(() => db.config.bulkGet(['login::logo', 'login::name'])).subscribe(([logo, name]) => {
                this.loginLogo = logo?.value as string | undefined;
                this.loginName = name?.value as string | undefined;
            });

            void Config.refresh([...BRANDING_CONFIG_KEYS]).catch((err) => {
                console.warn('Failed to refresh login branding', err);
            });

            this.loadingStage = 'Checking your account…';

            let status;
            try {
                const username = await withTimeout(db.profile.get('username'), BOOT_LOCAL_TIMEOUT_MS, 'Profile lookup');

                status = username
                    ? 'configured'
                    : (await withTimeout(ServerManager.get(), BOOT_NETWORK_TIMEOUT_MS, 'Server status check')).status;
            } catch (err) {
                console.warn('Server Error (Likely the server is in a configured state)', err);
                status = 'configured';
            }

            if (status === 'unconfigured') {
                await this.clearSession();
                await router.push('/configure');
                return false;
            }

            const { value: token } = await Preferences.get({ key: 'token' });

            if (token) {
                this.loadingStage = 'Signing you in…';
                await this.refreshLogin();
            } else if (router.currentRoute.value.name !== 'login') {
                await this.routeLogin();
            }

            return true;
        },

        teardown(): void {
            systemThemeQuery?.removeEventListener('change', handleSystemThemeChange);

            if (displayStyleSub) {
                displayStyleSub.unsubscribe();
                displayStyleSub = undefined;
            }

            if (brandingSub) {
                brandingSub.unsubscribe();
                brandingSub = undefined;
            }
        },
    },
});

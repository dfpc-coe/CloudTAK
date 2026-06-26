import { defineStore } from 'pinia';
import { liveQuery, type Subscription } from 'dexie';
import { Preferences } from '@capacitor/preferences';
import { StatusBar } from '@capacitor/status-bar';
import KV from '../base/kv.ts';
import { db } from '../database.ts';
import Config from '../base/config.ts';
import ServerManager from '../base/server.ts';
import router from '../router.ts';
import { isNativePlatform } from '../base/capacitor.ts';

export type DisplayStyleMode = 'System Default' | 'Light' | 'Dark';
export type ResolvedThemeMode = 'light' | 'dark';

// Kept outside Pinia state so Vue does not attempt to proxy them.
let displayStyleSub: Subscription | undefined;
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
            await KV.generate('serverUrl', serverUrl);
            await Preferences.set({ key: 'serverUrl', value: serverUrl });
        },

        async persistSession(opts: { token: string; username: string; session: string }): Promise<void> {
            await Preferences.set({ key: 'token', value: opts.token });
            await KV.generate('token', opts.token);
            await KV.generate('username', opts.username);

            // The device/session ID is returned explicitly by the login API.
            // Persist it in Preferences for the main thread and KV so the
            // worker (which cannot read Preferences) can access it too.
            await Preferences.set({ key: 'sessionId', value: opts.session });
            await KV.generate('sessionId', opts.session);
        },

        async getSessionId(): Promise<string | undefined> {
            const { value } = await Preferences.get({ key: 'sessionId' });
            return value ?? undefined;
        },

        async getUsername(): Promise<string | undefined> {
            return await KV.value('username');
        },

        // Removes the token but leaves the database intact so a quick re-login
        // after token expiry does not need to resynchronize all data.
        async clearSession(): Promise<void> {
            await Preferences.remove({ key: 'token' });
            await Preferences.remove({ key: 'sessionId' });
            await KV.delete('token');
            await KV.delete('sessionId');
        },

        // Clears the token AND wipes the database. Used on explicit sign-out or
        // when a different user logs in.
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

        routeLogin(): void {
            const redirect = encodeURIComponent(window.location.pathname);
            if (router.hasRoute('login')) {
                void router.push(`/login?redirect=${redirect}`);
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
                // Do NOT wipe the database — only clear the token so cached data
                // is preserved for re-login.
                await this.clearSession();
                this.routeLogin();
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

        // Returns true when bootstrap completed normally, false when it
        // short-circuited with a redirect so callers can skip follow-up work.
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
                } else {
                    await this.setServerUrl(serverUrl);
                }
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

            this.loadingStage = 'Checking your account…';

            let status;
            const username = await db.profile.get('username');

            if (username) {
                status = 'configured';
            } else {
                try {
                    const server = await ServerManager.get();
                    status = server.status;
                } catch (err) {
                    console.warn('Server Error (Likely the server is in a configured state)', err);
                    status = 'configured';
                }
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
                this.routeLogin();
            }

            this.loadingStage = 'Loading app settings…';

            const config = await Config.list([
                'login::name',
                'login::logo',
                'login::brand::enabled',
                'login::brand::logo',
                'login::background::enabled',
                'login::background::color',
                'login::signup',
                'login::forgot',
                'login::username'
            ]);

            this.loginLogo = config['login::logo'];
            this.loginName = config['login::name'];

            return true;
        },

        teardown(): void {
            systemThemeQuery?.removeEventListener('change', handleSystemThemeChange);

            if (displayStyleSub) {
                displayStyleSub.unsubscribe();
                displayStyleSub = undefined;
            }
        },
    },
});

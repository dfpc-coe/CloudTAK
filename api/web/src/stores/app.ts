import { defineStore } from 'pinia';
import type { Subscription } from 'dexie';
import { Preferences } from '@capacitor/preferences';
import { StatusBar, Style } from '@capacitor/status-bar';
import KV from '../base/kv.ts';
import { db, liveQuery } from '../database.ts';
import { withTimeout } from '../utils/async.ts';
import Config from '../base/config.ts';
import ServerManager from '../base/server.ts';
import router from '../router.ts';
import { isNativePlatform, isAndroidPlatform } from '../utils/capacitor.ts';
import { GeolocationPermission } from './device.ts';
import { server, setSessionRefresher } from '../std.ts';

// A failed refresh is not retried for this long so a dead session does not
// hammer the API from every expiry check
const REFRESH_RETRY_MS = 10 * 60 * 1000;

let refreshInflight: Promise<string | undefined> | undefined;
let refreshFailedAt = 0;

function decodeToken(token: string): { expiry: number; lifetime: number } {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return {
        expiry: payload.exp * 1000,
        lifetime: (payload.exp - payload.iat) * 1000,
    };
}

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
        tokenLifetime: number | null;
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
        tokenLifetime: null,
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
        },

        async persistSession(opts: { token: string; refresh?: string; username: string; session: string }): Promise<void> {
            await Preferences.set({ key: 'token', value: opts.token });
            await KV.generate('token', opts.token);
            await KV.generate('username', opts.username);

            if (opts.refresh) {
                await Preferences.set({ key: 'refresh', value: opts.refresh });
            } else {
                await Preferences.remove({ key: 'refresh' });
            }

            this.applyToken(opts.token);

            // Native location delivery authenticates with its own copy of the
            // token - keep it current if a watch is already running
            await GeolocationPermission.updateNativeHeaders({ Authorization: `Bearer ${opts.token}` });

            await Preferences.set({
                key: 'sessionId',
                value: opts.session
            });

            await KV.generate('sessionId', opts.session);
        },

        applyToken(token: string): void {
            const decoded = decodeToken(token);
            this.tokenExpiry = decoded.expiry;
            this.tokenLifetime = decoded.lifetime;
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
                    Preferences.remove({ key: 'refresh' }),
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
                await router.replace(`/login?redirect=${redirect}`);
            } else {
                window.location.href = `/login?redirect=${redirect}`;
            }
        },

        /**
         * Exchange the stored refresh token for a new login token, returning
         * the new token or undefined when the session cannot be extended
         */
        async refreshSession(): Promise<string | undefined> {
            if (refreshInflight) return await refreshInflight;
            if (Date.now() - refreshFailedAt < REFRESH_RETRY_MS) return undefined;

            refreshInflight = (async () => {
                const { value: refresh } = await Preferences.get({ key: 'refresh' });
                if (!refresh) return undefined;

                const res = await server.POST('/api/login/refresh', { body: { refresh } });

                if (res.error) {
                    // Anything but a rejection is a network fault - the old
                    // refresh token is still good, so try again later
                    if (res.response.status === 401) {
                        await Preferences.remove({ key: 'refresh' });
                    }
                    refreshFailedAt = Date.now();
                    return undefined;
                }

                await this.persistSession({
                    token: res.data.token,
                    refresh: res.data.refresh,
                    username: res.data.email,
                    session: res.data.session,
                });

                setSessionRefresher(() => this.refreshSession());

                const { useMapStore } = await import('./map.ts');
                await useMapStore().updateToken(res.data.token);

                return res.data.token;
            })().catch((err: unknown) => {
                console.error('Session refresh failed', err);
                refreshFailedAt = Date.now();
                return undefined;
            }).finally(() => {
                refreshInflight = undefined;
            });

            return await refreshInflight;
        },

        async refreshLogin(): Promise<void> {
            this.loading = true;

            try {
                const { value: token } = await Preferences.get({ key: 'token' });

                if (!token || Date.now() > decodeToken(token).expiry) {
                    if (!await this.refreshSession()) throw new Error(token ? 'Token expired' : 'No token found');
                } else {
                    this.applyToken(token);
                }

                setSessionRefresher(() => this.refreshSession());

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

        // The token expired or was rejected by the server. Unlike logout()
        // this keeps the local database so cached data survives the re-login.
        async sessionExpired(): Promise<void> {
            if (await this.refreshSession()) return;

            this.user = false;
            this.tokenExpiry = null;
            setSessionRefresher(undefined);
            await this.clearSession();
            await this.routeLogin();
        },

        // The server terminated this session - nothing to revoke, just wipe
        // the device and return to login
        async sessionRevoked(): Promise<void> {
            this.user = false;
            this.tokenExpiry = null;
            setSessionRefresher(undefined);

            await this.destroySession();
            window.location.href = '/login';
        },

        async logout(): Promise<void> {
            this.user = false;
            this.tokenExpiry = null;
            setSessionRefresher(undefined);

            // Revoke server side so the login and refresh tokens die with the session
            try {
                const [username, session] = await Promise.all([this.getUsername(), this.getSessionId()]);
                if (username && session) {
                    await withTimeout(server.DELETE('/api/user/{:username}/session/{:session}', {
                        params: { path: { ':username': username, ':session': session } },
                    }), BOOT_NETWORK_TIMEOUT_MS, 'Session revoke');
                }
            } catch (err) {
                console.warn('Session revoke did not complete', err);
            }

            await this.sessionRevoked();
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
            }

            this.loadingStage = 'Setting up styles…';

            if (isNativePlatform()) {
                try {
                    // Transparent status bar drawn over the map; a scrim in
                    // Map.vue tints the inset area to match the top controls
                    await StatusBar.setOverlaysWebView({ overlay: true });
                    await StatusBar.setStyle({ style: Style.Dark });

                    // Android WebViews don't reliably report env(safe-area-inset-top),
                    // so publish the native height as a fallback for --status-bar-height.
                    // iOS relies on env() alone - this measurement would go stale
                    // when its status bar hides in landscape.
                    if (isAndroidPlatform()) {
                        const { height } = await StatusBar.getInfo();
                        if (height > 0) {
                            document.documentElement.style.setProperty('--status-bar-native-height', `${height}px`);
                        }
                    }
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

            // Branding must never block boot: cached values now, network only for missing keys
            brandingSub = liveQuery(() => db.config.bulkGet(['login::logo', 'login::name'])).subscribe(([logo, name]) => {
                this.loginLogo = logo?.value as string | undefined;
                this.loginName = name?.value as string | undefined;
            });

            void Config.list([...BRANDING_CONFIG_KEYS])
                .then(() => Config.sync())
                .catch((err) => {
                    console.warn('Failed to load login branding', err);
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

import { defineStore } from 'pinia';

export type DisplayStyleMode = 'System Default' | 'Light' | 'Dark';
export type ResolvedThemeMode = 'light' | 'dark';

/**
 * Application-level store — available before the map initialises.
 *
 * Holds auth state, branding, theme, and device-detection flags that are
 * needed on the login/configure screens and that outlive individual map
 * sessions.
 */
export const useAppStore = defineStore('cloudtak-app', {
    state: (): {
        /** JWT expiry timestamp (ms since epoch), or null when not signed in. */
        tokenExpiry: number | null;

        /** True once the user has successfully authenticated. */
        user: boolean;

        /** True when the viewport is narrow enough to be treated as mobile. */
        isMobileDetected: boolean;

        /** Server-configured login logo URL (undefined = use default). */
        loginLogo: string | undefined;

        /** Server-configured agency / instance name shown in the nav bar. */
        loginName: string | undefined;

        /** User-selected display style preference. */
        displayStyle: DisplayStyleMode;

        /** Currently applied resolved theme (dark/light). */
        resolvedTheme: ResolvedThemeMode;
    } => ({
        tokenExpiry: null,
        user: false,
        isMobileDetected: false,
        loginLogo: undefined,
        loginName: undefined,
        displayStyle: 'System Default',
        resolvedTheme: 'dark',
    }),
});

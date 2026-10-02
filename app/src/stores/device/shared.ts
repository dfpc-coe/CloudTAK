import type { BrowserPermissionState } from './types.ts';

export class PermissionQuery {
    static hasPermissionQuery(): boolean {
        return 'permissions' in navigator && typeof navigator.permissions?.query === 'function';
    }

    static async queryPermissionStatus(name: string, warning: string): Promise<PermissionStatus | null> {
        if (!PermissionQuery.hasPermissionQuery()) return null;

        try {
            return await navigator.permissions.query({ name } as PermissionDescriptor);
        } catch (err) {
            console.warn(warning, err);
            return null;
        }
    }
}

/**
 * Normalize a native plugin or web permission state into a BrowserPermissionState.
 * Handles Capacitor's `prompt-with-rationale` and the web Notification API's `default`.
 */
export function normalizePermissionState(state: string | null | undefined): BrowserPermissionState {
    switch (state) {
        case 'granted':
        case 'denied':
            return state;
        case 'prompt':
        case 'prompt-with-rationale':
        case 'default':
            return 'prompt';
        default:
            return 'unknown';
    }
}


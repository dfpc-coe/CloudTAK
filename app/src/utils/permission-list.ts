/**
 * Which permission rows make sense where.
 *
 * Settings > Permissions was written for browsers. Two of its rows are web
 * features with no Android or iOS counterpart: asking the browser not to evict
 * the site's saved data (`navigator.storage.persist()`), and the browser's file
 * picker (`showOpenFilePicker`). In the phone app's WebView they only ever
 * report "Denied" or "Not asked yet", and there is nothing a user can do about
 * it, so the app does not list them. Background Location is the opposite: a
 * phone concept that a browser has no equivalent of.
 */
export type ListedPermission = 'location' | 'backgroundLocation' | 'notification' | 'orientation' | 'storage' | 'camera' | 'wakeLock' | 'fileSystem';

const WEB_ONLY: ReadonlySet<string> = new Set(['storage', 'fileSystem']);
const NATIVE_ONLY: ReadonlySet<string> = new Set(['backgroundLocation']);

export function isPermissionListed(key: ListedPermission, native: boolean): boolean {
    if (native) return !WEB_ONLY.has(key);
    return !NATIVE_ONLY.has(key);
}

import { describe, expect, it } from 'vitest';
import { isPermissionListed } from './permission-list.ts';
import type { ListedPermission } from './permission-list.ts';

const all: ListedPermission[] = ['location', 'backgroundLocation', 'notification', 'orientation', 'storage', 'camera', 'wakeLock', 'fileSystem'];

describe('isPermissionListed', () => {
    it('hides the browser-only rows in the phone app', () => {
        expect(isPermissionListed('storage', true)).toBe(false);
        expect(isPermissionListed('fileSystem', true)).toBe(false);
    });

    it('keeps every permission that exists on a phone', () => {
        const shown = all.filter((key) => isPermissionListed(key, true));
        expect(shown).toEqual(['location', 'backgroundLocation', 'notification', 'orientation', 'camera', 'wakeLock']);
    });

    it('keeps the browser rows in the web app, and hides background location there', () => {
        expect(isPermissionListed('storage', false)).toBe(true);
        expect(isPermissionListed('fileSystem', false)).toBe(true);
        expect(isPermissionListed('backgroundLocation', false)).toBe(false);
        expect(all.filter((key) => isPermissionListed(key, false))).toEqual(['location', 'notification', 'orientation', 'storage', 'camera', 'wakeLock', 'fileSystem']);
    });
});

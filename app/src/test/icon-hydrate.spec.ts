import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

const iconsets = [
    iconset('alpha'),
    iconset('bravo'),
];

const iconFetch = vi.fn();

vi.mock('../std.ts', () => ({
    server: {
        GET: async (path: string, opts?: { params?: { path?: Record<string, string>, query?: Record<string, unknown> } }) => {
            if (path === '/api/icon') {
                return { data: await iconFetch(String(opts?.params?.query?.iconset)) };
            } else if (path.endsWith('{:iconset}')) {
                return { data: iconsets.find((i) => i.uid === opts?.params?.path?.[':iconset']) };
            }

            return { data: { total: iconsets.length, items: iconsets } };
        }
    },
    stdurl: (url: string) => url,
    getRuntimeToken: async () => null,
    downloadUrl: vi.fn(),
}));

import { db } from '../database.ts';
import Icon from '../base/icon.ts';
import IconsetManager from '../base/iconset.ts';

function iconset(uid: string) {
    return {
        uid,
        created: '2026-01-01T00:00:00Z',
        updated: '2026-01-01T00:00:00Z',
        version: 1,
        name: uid,
        username: null,
        username_internal: false,
        default_group: null,
        default_friendly: null,
        default_hostile: null,
        default_neutral: null,
        default_unknown: null,
        skip_resize: false,
    };
}

function icons(uid: string) {
    return {
        total: 1,
        items: [{
            iconset: uid,
            name: `${uid}.png`,
            path: `${uid}/${uid}.png`,
            type2525b: null,
            updated: '2026-01-01T00:00:00Z',
            data: PNG
        }]
    };
}

async function count(uid: string): Promise<number> {
    return await db.icon.where('iconset').equals(uid).count();
}

beforeEach(async () => {
    iconFetch.mockReset();
    iconFetch.mockImplementation(async (uid: string) => icons(uid));

    await Promise.all([
        db.icon.clear(),
        db.iconset.clear(),
        db.cache.clear(),
        db.sprite.put({ id: 'default', updated: Date.now(), json: {}, image: new Blob() })
    ]);
});

describe('Icon.hydrate', () => {
    it('fetches icons for iconset rows written without icons', async () => {
        await db.iconset.bulkPut(iconsets);

        const result = await Icon.hydrate();

        expect(result.added.sort()).toEqual(['alpha', 'bravo']);
        expect(await count('alpha')).toBe(1);
        expect(await count('bravo')).toBe(1);
    });

    it('syncs the remaining iconsets when one fails and retries it next time', async () => {
        iconFetch.mockImplementation(async (uid: string) => {
            if (uid === 'bravo') throw new Error('boom');
            return icons(uid);
        });

        expect((await Icon.hydrate()).failed).toEqual(['bravo']);
        expect(await count('alpha')).toBe(1);
        expect(await count('bravo')).toBe(0);

        iconFetch.mockImplementation(async (uid: string) => icons(uid));

        const result = await Icon.hydrate();
        expect(result.added).toEqual(['bravo']);
        expect(result.failed).toEqual([]);
        expect(await count('bravo')).toBe(1);
    });

    it('does not refetch iconsets that already have icons', async () => {
        await Icon.hydrate();
        iconFetch.mockClear();

        const result = await Icon.hydrate();
        expect(result.added).toEqual([]);
        expect(iconFetch).not.toHaveBeenCalled();
    });

    it('keeps the sync marker when IconsetManager rewrites the rows', async () => {
        await Icon.hydrate();
        await IconsetManager.sync();
        await IconsetManager.get('alpha');
        iconFetch.mockClear();

        expect(Icon.stale(await db.iconset.get('alpha'))).toBe(false);

        await Icon.hydrate();
        expect(iconFetch).not.toHaveBeenCalled();
    });
});

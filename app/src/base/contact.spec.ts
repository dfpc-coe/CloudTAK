import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ContactRecord } from '../types.ts';

const GET = vi.hoisted(() => vi.fn());
vi.mock('../std.ts', () => ({ server: { GET }, bearer: () => undefined, stdurl: (url: string) => url }));

import { db } from '../database.ts';
import ContactManager, { CONTACT_RECENT_MS, CONTACT_TOUCH_INTERVAL_MS } from './contact.ts';

const NOW = Date.parse('2026-05-01T12:00:00.000Z');

function contact(uid: string, lastSeen?: number): ContactRecord {
    return {
        uid,
        callsign: uid.toUpperCase(),
        notes: '',
        filterGroups: null,
        team: 'Cyan',
        role: 'Team Member',
        takv: '',
        ...(lastSeen === undefined ? {} : { lastSeen }),
    } as ContactRecord;
}

async function uids(): Promise<string[]> {
    return (await db.contact.toArray()).map((c) => c.uid).sort();
}

beforeEach(async () => {
    await db.contact.clear();
    await db.cache.clear();
    GET.mockReset();
});

describe('ContactManager.isRecent', () => {
    it('is true inside the window and false outside it', () => {
        expect(ContactManager.isRecent(contact('a', NOW - CONTACT_RECENT_MS + 1), NOW)).toBe(true);
        expect(ContactManager.isRecent(contact('a', NOW - CONTACT_RECENT_MS), NOW)).toBe(false);
    });

    it('treats a row without lastSeen as not recent', () => {
        expect(ContactManager.isRecent(contact('a'), NOW)).toBe(false);
    });
});

describe('ContactManager.touch', () => {
    it('stamps a row that has no lastSeen', async () => {
        await db.contact.put(contact('a'));
        await ContactManager.touch(contact('a'), NOW);
        expect((await db.contact.get('a'))?.lastSeen).toBe(NOW);
    });

    it('skips the write when the stamp is newer than the touch interval', async () => {
        const stamp = NOW - CONTACT_TOUCH_INTERVAL_MS + 1000;
        await db.contact.put(contact('a', stamp));
        await ContactManager.touch(contact('a', stamp), NOW);
        expect((await db.contact.get('a'))?.lastSeen).toBe(stamp);
    });

    it('refreshes the stamp once the touch interval has passed', async () => {
        const stamp = NOW - CONTACT_TOUCH_INTERVAL_MS;
        await db.contact.put(contact('a', stamp));
        await ContactManager.touch(contact('a', stamp), NOW);
        expect((await db.contact.get('a'))?.lastSeen).toBe(NOW);
    });
});

describe('ContactManager.prune', () => {
    it('deletes unstamped and expired rows and keeps recent ones', async () => {
        await db.contact.bulkPut([
            contact('recent', NOW - 60_000),
            contact('expired', NOW - CONTACT_RECENT_MS - 1),
            contact('legacy'),
        ]);
        expect(await ContactManager.prune(new Set(), NOW)).toBe(2);
        expect(await uids()).toEqual(['recent']);
    });

    it('keeps online contacts even when their stamp is old or missing', async () => {
        await db.contact.bulkPut([
            contact('online-old', NOW - CONTACT_RECENT_MS * 24),
            contact('online-legacy'),
            contact('gone', NOW - CONTACT_RECENT_MS * 24),
        ]);
        await ContactManager.prune(new Set(['online-old', 'online-legacy']), NOW);
        expect(await uids()).toEqual(['online-legacy', 'online-old']);
    });
});

describe('ContactManager.sync', () => {
    it('updates stored contacts, keeps lastSeen, and does not add unknown ones', async () => {
        await db.contact.put(contact('a', NOW));
        GET.mockResolvedValue({
            data: [
                { ...contact('a'), callsign: 'RENAMED' },
                contact('unknown'),
                contact('me'),
            ],
        });

        await ContactManager.sync('me');

        expect(await uids()).toEqual(['a']);
        const row = await db.contact.get('a');
        expect(row?.callsign).toBe('RENAMED');
        expect(row?.lastSeen).toBe(NOW);
    });
});

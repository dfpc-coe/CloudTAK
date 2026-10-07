import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../database.ts';
import Filter, { EDIT_HIDE_PREFIX } from '../base/filter.ts';

describe('Filter.purgeEditHides', () => {
    beforeEach(async () => {
        await db.filter.clear();
    });

    it('removes only edit-hide filters', async () => {
        await Filter.create('Edit Hidden', `${EDIT_HIDE_PREFIX}uid-1`, 'AtlasDatabase', true, 'id = "uid-1"');
        await Filter.create('Another Edit', `${EDIT_HIDE_PREFIX}uid-2`, 'AtlasDatabase', true, 'id = "uid-2"');
        await Filter.create('User Filter', 'user-filter', 'AtlasDatabase', false, 'properties.type = "a-f-G"');

        expect(await Filter.purgeEditHides()).toEqual(2);

        const remaining = await Filter.list();
        expect(remaining.map((f) => f.external)).toEqual(['user-filter']);
    });

    it('is a no-op without edit-hide filters', async () => {
        expect(await Filter.purgeEditHides()).toEqual(0);
    });
});

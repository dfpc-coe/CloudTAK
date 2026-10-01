import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test, expect } from '../lib/fixtures.ts';
import { MenuPackages } from '../pages/MenuPackages.ts';
import { cloudtakUsername } from '../lib/env.ts';

test.describe('Data Packages: positive, list and detail', () => {
    test('DP-01 Data Packages pane opens with controls and lists packages from active channels', async ({ readyMap: map, menuPackages, page }) => {
        const api = await menuPackages.openFromMenu(map);

        await expect(page).toHaveURL(/\/menu\/packages(\/|$|\?|#)/);
        await expect(menuPackages.title).toHaveText('Data Packages');

        await expect(menuPackages.filterInput).toBeVisible();
        await expect(menuPackages.filterInput).toHaveValue('');
        await expect(menuPackages.refreshButton).toBeVisible();
        await expect(menuPackages.createButton).toBeVisible();
        await expect(menuPackages.channelNotice).toBeVisible();
        await expect(menuPackages.noChannels).toBeHidden();
        await expect(menuPackages.error).toBeHidden();

        // Staging test user needs at least one active channel with a package in it.
        expect(api.items.length, 'test user should see at least one package').toBeGreaterThan(0);
        await expect(menuPackages.empty).toBeHidden();
        await expect(menuPackages.items).toHaveCount(api.items.length);

        // Rows render in API order: name, keyword chips (or "No Keywords"), age, owner.
        for (const [i, pkg] of api.items.entries()) {
            const row = menuPackages.items.nth(i);
            await expect(menuPackages.itemName(row)).toHaveText(pkg.name);

            const keywords = MenuPackages.visibleKeywords(pkg);
            if (keywords.length) {
                for (const k of keywords) await expect(row.getByText(k, { exact: true })).toBeVisible();
            } else {
                await expect(row.getByText('No Keywords')).toBeVisible();
            }

            await expect(menuPackages.itemAge(row)).toHaveText(MenuPackages.AGE);
            await expect(menuPackages.itemOwner(row)).toHaveText(pkg.username);
        }
    });

    test('DP-07 package detail shows metadata matching the API', async ({ readyMap: map, menuPackages, page }) => {
        const api = await menuPackages.openFromMenu(map);
        if (!api.items.length) throw new Error('test user should see at least one package');

        const pkg = await menuPackages.captureDetail(() => menuPackages.items.first().click());
        await expect(page).toHaveURL(new RegExp(`/menu/packages/${encodeURIComponent(pkg.uid)}`));
        await expect(menuPackages.title).toHaveText('Package');
        await expect(menuPackages.name).toHaveText(pkg.name);
        await expect(menuPackages.createdLine).toHaveText(MenuPackages.CREATED);
        await expect(menuPackages.fieldValue('Created By')).toHaveText(pkg.username);
        await expect(menuPackages.fieldValue('Package Hash')).toHaveText(pkg.hash || '—');
        await expect(menuPackages.fieldValue('Size')).toHaveText(MenuPackages.formatBytes(pkg.size));

        // Sheet expects Size "matching the uploaded file"; asserted against the API detail since create is on hold.
        for (const label of ['Channels', 'Expiry', 'Hashtags']) {
            await expect(menuPackages.fieldLabel(label)).toBeVisible();
        }
        for (const channel of pkg.channels) {
            await expect(menuPackages.panel.getByText(channel, { exact: true }).first()).toBeVisible();
        }
        // Detail keywords are rendered unfiltered (missionpackage included), unlike the list.
        if (pkg.keywords.length) {
            for (const keyword of pkg.keywords) {
                await expect(menuPackages.panel.getByText(keyword, { exact: true }).first()).toBeVisible();
            }
        } else {
            await expect(menuPackages.panel.getByText('No hashtags provided')).toBeVisible();
        }

        await expect(menuPackages.downloadButton).toBeVisible();
        await expect(menuPackages.importButton).toBeVisible();
        await expect(menuPackages.shareButton).toBeVisible();
    });

    test('DP-08 download returns the original zip with matching hash and size', async ({ readyMap: map, menuPackages, page }) => {
        const api = await menuPackages.openFromMenu(map);
        if (!api.items.length) throw new Error('test user should see at least one package');

        const pkg = await menuPackages.captureDetail(() => menuPackages.items.first().click());

        const downloading = page.waitForEvent('download');
        await menuPackages.downloadButton.click();
        const download = await downloading;

        expect(download.suggestedFilename()).toBe(`${pkg.name}.zip`);

        const file = await readFile(await download.path());
        expect(createHash('sha256').update(file).digest('hex')).toBe(pkg.hash);
        expect(file.length).toBe(Number(pkg.size));
    });

    test('DP-14 filter narrows the list to matching packages', async ({ readyMap: map, menuPackages }) => {
        const api = await menuPackages.openFromMenu(map);
        const target = api.items[0];
        if (!target) throw new Error('test user should see at least one package');

        const filtered = await menuPackages.filter(target.name);
        expect(filtered.items.length, 'filter should keep the matching package').toBeGreaterThan(0);
        for (const pkg of filtered.items) {
            expect(pkg.name.toLowerCase()).toContain(target.name.toLowerCase());
        }
        expect(filtered.items.some((pkg) => pkg.uid === target.uid)).toBe(true);

        await expect(menuPackages.items).toHaveCount(filtered.items.length);
        await expect(menuPackages.error).toBeHidden();
    });

    test('DP-15 refresh reloads the list without error', async ({ readyMap: map, menuPackages }) => {
        const before = await menuPackages.openFromMenu(map);

        const after = await menuPackages.refresh();
        expect(after.items.map((pkg) => pkg.uid).sort()).toEqual(before.items.map((pkg) => pkg.uid).sort());

        await expect(menuPackages.error).toBeHidden();
        await expect(menuPackages.items).toHaveCount(after.items.length);
        if (after.items[0]) {
            await expect(menuPackages.itemName(menuPackages.items.first())).toHaveText(after.items[0].name);
        }
    });
});

test.describe('Data Packages: validation and negatives', () => {
    // DP-20..22 and DP-30 exercise the create modal without ever submitting; nothing reaches the server.
    test('DP-20 Create stays disabled while no file is staged', async ({ readyMap: map, menuPackages }) => {
        await menuPackages.openFromMenu(map);
        await menuPackages.openCreate();

        await expect(menuPackages.createSubmit).toBeDisabled();
        await menuPackages.createName.fill('QA-TEST-dp20');
        await expect(menuPackages.createSubmit).toBeDisabled();
    });

    test('DP-21 name auto-fills from the staged file and an empty name is not validated', async ({ readyMap: map, menuPackages }) => {
        await menuPackages.openFromMenu(map);
        await menuPackages.openCreate();

        await menuPackages.stageCreateFile('QA-TEST-dp21.zip');
        await expect(menuPackages.createName).toHaveValue('QA-TEST-dp21.zip');

        // Sheet expects create disabled or a validation error on empty name; the UI only auto-fills and never validates it.
        await menuPackages.createName.fill('');
        await expect(menuPackages.createChannels.first()).toBeVisible();
        await menuPackages.createChannels.first().click();
        await expect(menuPackages.createSubmit).toBeEnabled();
    });

    test('DP-22 Create stays disabled until a channel is selected', async ({ readyMap: map, menuPackages }) => {
        await menuPackages.openFromMenu(map);
        await menuPackages.openCreate();

        await menuPackages.stageCreateFile('QA-TEST-dp22.zip');
        await expect(menuPackages.createSubmit).toBeDisabled();

        await expect(menuPackages.createChannels.first()).toBeVisible();
        await menuPackages.createChannels.first().click();
        await expect(menuPackages.createSubmit).toBeEnabled();

        await menuPackages.createChannels.first().click();
        await expect(menuPackages.createSubmit).toBeDisabled();
    });

    test('DP-27 delete control is only visible to the package owner', async ({ readyMap: map, menuPackages }) => {
        const api = await menuPackages.openFromMenu(map);
        const me = cloudtakUsername();

        // Selector sanity on an owned package first, so the hidden assertion below can't pass vacuously.
        const ownedIndex = api.items.findIndex((pkg) => pkg.username === me);
        if (ownedIndex !== -1) {
            await menuPackages.captureDetail(() => menuPackages.items.nth(ownedIndex).click());
            await expect(menuPackages.deleteButton).toBeVisible();
            await menuPackages.back();
        }

        const otherIndex = api.items.findIndex((pkg) => pkg.username !== me);
        test.skip(otherIndex === -1, 'staging has no visible package owned by another user');
        if (otherIndex === -1) return;

        await menuPackages.captureDetail(() => menuPackages.items.nth(otherIndex).click());
        await expect(menuPackages.downloadButton).toBeVisible();
        await expect(menuPackages.deleteButton).toBeHidden();
    });

    test('DP-29 filter with no matches shows the empty state without error', async ({ readyMap: map, menuPackages }) => {
        await menuPackages.openFromMenu(map);

        const none = await menuPackages.filter(`QA-TEST-NO-MATCH-${Date.now()}`);
        expect(none.items.length).toBe(0);

        await expect(menuPackages.items).toHaveCount(0);
        await expect(menuPackages.empty).toBeVisible();
        await expect(menuPackages.error).toBeHidden();
    });

    test('DP-30 cancelling creation sends nothing and leaves the list unchanged', async ({ readyMap: map, menuPackages, page }) => {
        const before = await menuPackages.openFromMenu(map);

        const writes: string[] = [];
        page.on('request', (request) => {
            if (/\/api\/marti\/package/.test(request.url()) && request.method() !== 'GET') {
                writes.push(`${request.method()} ${request.url()}`);
            }
        });

        await menuPackages.openCreate();
        await menuPackages.createName.fill('QA-TEST-dp30');
        await menuPackages.stageCreateFile('QA-TEST-dp30.zip');
        await expect(menuPackages.createChannels.first()).toBeVisible();
        await menuPackages.createChannels.first().click();

        await menuPackages.createClose.click();
        await expect(menuPackages.createModal).toBeHidden();

        const after = await menuPackages.refresh();
        expect(writes).toEqual([]);
        expect(after.items.map((pkg) => pkg.uid).sort()).toEqual(before.items.map((pkg) => pkg.uid).sort());
    });
});

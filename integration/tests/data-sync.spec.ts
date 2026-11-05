import type { Page } from '@playwright/test';
import { test, expect, completeFirstLoginSetup } from '../lib/fixtures.ts';
import { MenuMissions } from '../pages/MenuMissions.ts';
import { MenuMission } from '../pages/MenuMission.ts';
import { getMissionOverlays, waitForSubscriptionSync } from '../lib/session.ts';
import { apiCreateMission, apiDeleteMission, apiGetClientCallsign, apiGetMissionRole, apiListMissions, apiSubmitMissionFeature } from '../lib/missions.ts';
import { cloudtakUsername1 } from '../lib/env.ts';
import {
    CHANNEL,
    USER2_CALLSIGN,
    createMissionViaForm,
    deleteMissionsNamed,
    openMissionFromAvailable,
    openSecondUser,
    remountUsersTab,
    subscribeSecondUser,
    trackMissionCreates,
} from '../lib/data-sync.ts';

test.describe('Data Sync list panel', () => {
    test.beforeEach(async ({ readyMap, page }) => {
        await waitForSubscriptionSync(page);
        await readyMap.activeMission.click();
        await expect(readyMap.panelTitle).toHaveText('Data Syncs');
    });

    test('DS-01 "No Active Mission" badge opens the Data Syncs panel at /menu/missions', async ({ readyMap, page }) => {
        await expect(page).toHaveURL(/\/menu\/missions([/#?]|$)/);
        await expect(readyMap.panelTitle).toHaveText('Data Syncs');
    });

    test('DS-02 Subscribed and Available tabs are visible and switch the list', async ({ page }) => {
        const missions = new MenuMissions(page);
        const subs = (await getMissionOverlays(page)).map((overlay) => overlay.name).sort();

        await expect(missions.tab('Subscribed')).toBeVisible();
        await expect(missions.tab('Available')).toBeVisible();
        await expect(missions.tabRadio(subs.length ? 'Subscribed' : 'Available')).toBeChecked();

        await missions.tab('Subscribed').click();
        await expect(missions.tabRadio('Subscribed')).toBeChecked();
        if (subs.length) {
            await expect.poll(async () => (await missions.names()).sort()).toEqual(subs);
        } else {
            await expect(missions.noSubscribed).toBeVisible();
            await expect(missions.rows).toHaveCount(0);
        }

        // Available tab shows a different list, without the subscribed missions
        await missions.tab('Available').click();
        await expect(missions.tabRadio('Available')).toBeChecked();
        await missions.waitForList();
        const available = await missions.names();
        for (const name of subs) expect(available).not.toContain(name);
    });

    test('DS-04 refresh reloads the Available list with the same mission names', async ({ page }) => {
        const missions = new MenuMissions(page);
        await missions.showAvailable();

        const before = await missions.names();
        expect(before.length).toBeGreaterThan(0);

        await Promise.all([
            page.waitForResponse((res) => res.url().includes('/api/marti/mission?')),
            missions.refresh.click(),
        ]);

        await missions.waitForList();
        await expect.poll(() => missions.names()).toEqual(before);
    });

    test('DS-05 filtering by part of a mission name narrows the list; clearing restores it', async ({ page }) => {
        const missions = new MenuMissions(page);
        await missions.showAvailable();

        const all = await missions.names();
        const target = all[0];
        if (target === undefined) throw new Error('expected at least one mission in the Available list');

        // Lower-cased prefix: the filter matches case-insensitively on the name
        const fragment = target.slice(0, Math.ceil(target.length / 2)).toLowerCase();
        const expected = all.filter((name) => name.toLowerCase().includes(fragment));

        await missions.filterInput.fill(fragment);
        await expect.poll(() => missions.names()).toEqual(expected);
        expect(expected).toContain(target);

        await missions.filterInput.fill('');
        await expect.poll(() => missions.names()).toEqual(all);
    });

    test('DS-06 a filter with no match shows "No data syncs match your filter"', async ({ page }) => {
        const missions = new MenuMissions(page);
        await missions.showAvailable();

        await missions.filterInput.fill('QA-TEST-no-such-data-sync');
        await expect(missions.noMatch).toBeVisible();
        await expect(missions.rows).toHaveCount(0);

        await missions.filterInput.fill('');
        await missions.waitForList();
        await expect(missions.noMatch).toBeHidden();
    });

    test('DS-08 sort menu offers 4 options on Available; A → Z orders names alphabetically', async ({ page }) => {
        const missions = new MenuMissions(page);
        await missions.showAvailable();

        const names = await missions.names();

        await missions.sortButton.click();
        await expect(missions.sortOptions).toHaveText([
            'Newest → Oldest',
            'Oldest → Newest',
            'A → Z',
            'Z → A',
        ]);

        await missions.sortOption('A → Z').click();
        const expected = [...names].sort((a, b) => a.localeCompare(b));
        await expect.poll(() => missions.names()).toEqual(expected);

        // Sort options are only passed on the Available tab
        await missions.tab('Subscribed').click();
        await expect(missions.sortButton).toBeHidden();
    });
});

test.describe('Data Sync list panel (seeded)', () => {
    const created: Array<{ guid: string; password?: string }> = [];

    test.beforeEach(async ({ readyMap }) => {
        await readyMap.activeMission.click();
        await expect(readyMap.panelTitle).toHaveText('Data Syncs');
    });

    test.afterEach(async ({ page }) => {
        for (const mission of created.splice(0)) {
            await apiDeleteMission(page, mission.guid, { password: mission.password });
        }
    });

    test('DS-07 the keyword filter shows only missions with that keyword', async ({ page }) => {
        const missions = new MenuMissions(page);
        const name = `QA-TEST-DS-07-${Date.now()}`;
        const keyword = `QA-TEST-KW-${Date.now()}`;

        const seeded = await apiCreateMission(page, { name, group: [CHANNEL], keywords: [keyword] });
        created.push({ guid: seeded.guid });

        await missions.showAvailable();
        // keywords filter via the Filterdropdown checkboxes, the text field matches names only
        await missions.filterButton.click();
        await page.locator('label.form-check').filter({ hasText: keyword }).click();

        await expect(missions.rows).toHaveCount(1);
        await expect(missions.rows.filter({ hasText: name })).toBeVisible();
        await expect(missions.rows.filter({ hasText: keyword })).toBeVisible();
    });

    test('DS-09 subscribed missions carry the Subscribed indicator', async ({ page, readyMap }) => {
        const missions = new MenuMissions(page);
        const mission = new MenuMission(page);
        const name = `QA-TEST-DS-09-${Date.now()}`;

        const seeded = await apiCreateMission(page, { name, group: [CHANNEL] });
        created.push({ guid: seeded.guid });

        await openMissionFromAvailable(missions, name);
        await mission.subscribeButton.click();
        await expect(mission.unsubscribeButton).toBeVisible({ timeout: 30_000 });
        await mission.back.click();
        await expect(readyMap.panelTitle).toHaveText('Data Syncs');

        const row = missions.rows.filter({ hasText: name });
        await missions.tab('Subscribed').click();
        await expect(row.locator('[title="Subscribed"]')).toBeVisible();

        // subscribed missions are excluded from the Available tab entirely, so the indicator only renders on Subscribed
        await missions.tab('Available').click();
        await expect(row).toHaveCount(0);
    });

    test('DS-10 clicking a locked mission shows the inline password field', async ({ page }) => {
        const missions = new MenuMissions(page);
        const name = `QA-TEST-DS-10-${Date.now()}`;
        const password = `QA-TEST-pw-${Date.now()}`;

        const seeded = await apiCreateMission(page, { name, group: [CHANNEL], password });
        created.push({ guid: seeded.guid, password });

        await missions.showAvailable();
        await missions.filterInput.fill(name);
        await missions.rows.filter({ hasText: name }).click();

        // The mission does not open; the row grows an inline password prompt
        await expect(missions.rowPasswordInput(name)).toBeVisible();
        await expect(missions.rowUnlockButton(name)).toBeVisible();
        await expect(page).toHaveURL(/\/menu\/missions([?#]|$)/);
    });
});

test.describe('Data Sync: subscribed empty state', () => {
    test('DS-03 Subscribed tab with no subscriptions shows the empty state', async ({ browser }) => {
        const other = await openSecondUser(browser);
        try {
            const overlays = await waitForSubscriptionSync(other.page);
            test.skip(overlays.length > 0, 'secondary user has subscriptions; DS-03 needs none');

            await other.map.activeMission.click();
            await expect(other.map.panelTitle).toHaveText('Data Syncs');

            // With no subscriptions the panel auto-switches to Available
            await expect(other.missions.tabRadio('Available')).toBeChecked();

            await other.missions.tab('Subscribed').click();
            await expect(other.missions.tabRadio('Subscribed')).toBeChecked();
            await expect(other.missions.noSubscribed).toBeVisible();
            await expect(other.missions.rows).toHaveCount(0);
        } finally {
            await other.context.close();
        }
    });
});

test.describe('Data Sync create mission modal', () => {
    test.beforeEach(async ({ readyMap }) => {
        await readyMap.activeMission.click();
        await expect(readyMap.panelTitle).toHaveText('Data Syncs');
    });

    test('DS-11 "Create Sync" opens the Create Mission modal with its fields; Close closes it', async ({ page }) => {
        const missions = new MenuMissions(page);
        await missions.openCreateModal();

        await expect(missions.modalTitle).toBeVisible();
        await expect(missions.field('Name')).toBeVisible();
        await expect(missions.searchTemplates).toBeVisible();
        await expect(missions.field('Description')).toBeVisible();
        await expect(missions.modal.getByText('Channels', { exact: true })).toBeVisible();
        await expect(missions.channelsFilter).toBeVisible();
        await expect(missions.createMission).toBeVisible();

        await missions.advancedOptions.click();
        await expect(missions.modal.getByText('Keywords', { exact: true })).toBeVisible();
        await expect(missions.newKeyword).toBeVisible();
        await expect(missions.modal.getByText('Password Protected')).toBeVisible();
        await expect(missions.passwordToggle).toBeAttached();
        await expect(missions.defaultRole).toBeVisible();

        await missions.modalClose.click();
        await expect(missions.modal).toBeHidden();
    });

    test('DS-12 template search filters the template list; Close Search hides it', async ({ page }) => {
        const missions = new MenuMissions(page);
        await missions.openCreateModal();

        await expect(missions.templateCards.first()).toBeVisible();
        const before = await missions.templateCardNames();
        expect(before[0]).toBe('Default');
        expect(before.length).toBeGreaterThan(1);

        await missions.searchTemplates.click();
        await expect(missions.templateSearchInput).toBeVisible();

        // Filtering happens server-side GET /api/template/mission?filter=
        await missions.templateSearchInput.fill('QA-TEST-no-such-template');
        await expect.poll(() => missions.templateCardNames()).toEqual(['Default']);

        await missions.closeTemplateSearch.click();
        await expect(missions.templateSearchInput).toBeHidden();
        await expect.poll(() => missions.templateCardNames()).toEqual(before);
    });

    test('DS-13 Default Role offers Read-Only, Subscriber, Owner', async ({ page }) => {
        const missions = new MenuMissions(page);
        await missions.openCreateModal();
        await missions.advancedOptions.click();

        await expect(missions.defaultRole).toBeVisible();
        await expect(missions.defaultRole.locator('option')).toHaveText(['Read-Only', 'Subscriber', 'Owner']);
        await expect(missions.defaultRole).toHaveValue('Subscriber');
    });

    test('DS-14 Password field is shown only while Password Protected is on', async ({ page }) => {
        const missions = new MenuMissions(page);
        await missions.openCreateModal();
        await missions.advancedOptions.click();

        await expect(missions.passwordInput).toBeHidden();
        await missions.passwordToggle.setChecked(true);
        await expect(missions.passwordInput).toBeVisible();
        await missions.passwordToggle.setChecked(false);
        await expect(missions.passwordInput).toBeHidden();
    });

    test('DS-15 closing the modal discards Name and Description', async ({ page }) => {
        const missions = new MenuMissions(page);
        await missions.openCreateModal();
        await missions.field('Name').fill('QA-TEST-DS-15');
        await missions.field('Description').fill('QA-TEST discard me');
        await missions.modalClose.click();
        await expect(missions.modal).toBeHidden();

        await missions.openCreateModal();
        await expect(missions.field('Name')).toHaveValue('');
        await expect(missions.field('Description')).toHaveValue('');
    });
});

test.describe('Data Sync creation methods', () => {
    const created: Array<{ guid: string; password?: string }> = [];

    test.beforeEach(async ({ readyMap }) => {
        await readyMap.activeMission.click();
        await expect(readyMap.panelTitle).toHaveText('Data Syncs');
    });

    test.afterEach(async ({ page }) => {
        for (const mission of created.splice(0)) {
            await apiDeleteMission(page, mission.guid, { password: mission.password });
        }
    });

    test('DS-16 create with the Default template lands on the mission page and subscribes', async ({ page, readyMap }) => {
        const missions = new MenuMissions(page);
        const mission = new MenuMission(page);
        const name = `QA-TEST-DS-16-${Date.now()}`;

        const { body, guid } = await createMissionViaForm(page, missions, {
            name,
            description: 'QA-TEST created by DS-16',
            template: 'Default',
            channel: CHANNEL,
            role: 'Subscriber',
        });
        created.push({ guid });

        expect(body.defaultRole).toBe('MISSION_SUBSCRIBER');
        expect(body.group).toContain(CHANNEL);

        // /menu/missions/<guid> redirects to the info tab
        await expect(page).toHaveURL(new RegExp(`/menu/missions/${guid}/info`), { timeout: 15_000 });

        await mission.back.click();
        await expect(readyMap.panelTitle).toHaveText('Data Syncs');
        await missions.tab('Subscribed').click();
        await expect(missions.rows.filter({ hasText: name })).toBeVisible();
    });

    test('DS-17 create with the Test template adds the template keyword', async ({ page }) => {
        const missions = new MenuMissions(page);
        const name = `QA-TEST-DS-17-${Date.now()}`;

        const { body, guid } = await createMissionViaForm(page, missions, {
            name,
            description: 'QA-TEST created by DS-17',
            template: 'TEST TEMPLATE',
            channel: CHANNEL,
        });
        created.push({ guid });

        expect(body.keywords ?? []).toContainEqual(expect.stringMatching(/^template:[0-9a-f-]{36}$/));
        await expect(page).toHaveURL(new RegExp(`/menu/missions/${guid}/info`), { timeout: 15_000 });
    });

    test('DS-18 create with role Read-Only sends MISSION_READONLY_SUBSCRIBER', async ({ page }) => {
        const missions = new MenuMissions(page);

        const { body, guid } = await createMissionViaForm(page, missions, {
            name: `QA-TEST-DS-18-${Date.now()}`,
            channel: CHANNEL,
            role: 'Read-Only',
        });
        created.push({ guid });

        expect(body.defaultRole).toBe('MISSION_READONLY_SUBSCRIBER');
        await expect(page).toHaveURL(new RegExp(`/menu/missions/${guid}/info`), { timeout: 15_000 });
    });

    test('DS-19 create with role Owner sends MISSION_OWNER', async ({ page }) => {
        const missions = new MenuMissions(page);

        const { body, guid } = await createMissionViaForm(page, missions, {
            name: `QA-TEST-DS-19-${Date.now()}`,
            channel: CHANNEL,
            role: 'Owner',
        });
        created.push({ guid });

        expect(body.defaultRole).toBe('MISSION_OWNER');
        await expect(page).toHaveURL(new RegExp(`/menu/missions/${guid}/info`), { timeout: 15_000 });
    });

    test.skip('DS-20 create password protected sends the password and flags the mission', async ({ page }) => {
        const missions = new MenuMissions(page);
        const name = `QA-TEST-DS-20-${Date.now()}`;
        const password = `QA-TEST-pw-${Date.now()}`;

        const { body, guid } = await createMissionViaForm(page, missions, {
            name,
            channel: CHANNEL,
            password,
        });
        created.push({ guid, password });

        expect(body.password).toBe(password);

        const listed = (await apiListMissions(page)).find((mission) => mission.guid === guid);
        expect(listed?.passwordProtected).toBe(true);

        // BUG-0002: create succeeds but the auto-subscribe fails with FORBIDDEN
        // "No token role provided", leaving the modal open under a Website Error
        // dialog and never navigating to the mission page
        await expect(missions.errorDialog).toBeVisible();
        await expect(missions.errorDialog).toContainText('Illegal attempt to subscribe to mission');
        await missions.errorDialog.locator('button.btn-close').click();
        await expect(missions.field('Name')).toHaveValue(name);
        await missions.modalClose.click();
        await expect(missions.modal).toBeHidden();

        // The creator never got subscribed, so the mission lists as Available with a lock.
        await missions.showAvailable();
        await Promise.all([
            page.waitForResponse((res) => res.url().includes('/api/marti/mission?')),
            missions.refresh.click(),
        ]);
        const row = missions.rows.filter({ hasText: name });
        await expect(row).toBeVisible();
        await expect(row.locator('.tabler-icon-lock')).toBeVisible();
    });

    test('DS-21 a mission created outside the form appears in the other user\'s Available tab after refresh', async ({ page, browser }) => {
        test.setTimeout(240_000);
        const name = `QA-TEST-DS-21-${Date.now()}`;

        const other = await openSecondUser(browser);
        try {
            await other.map.activeMission.click();
            await other.missions.showAvailable();
            await expect(other.missions.rows.filter({ hasText: name })).toHaveCount(0);

            // when the user A creates a mission outside the form (the
            // API create stands in for ATAK / TAK Server Mission Manager)
            const mission = await apiCreateMission(page, {
                name,
                group: [CHANNEL],
                description: 'QA-TEST created by DS-21 outside the form',
            });
            created.push({ guid: mission.guid });

            // After a refresh the user B sees it
            await Promise.all([
                other.page.waitForResponse((res) => res.url().includes('/api/marti/mission?')),
                other.missions.refresh.click(),
            ]);
            await expect(other.missions.rows.filter({ hasText: name })).toBeVisible();
        } finally {
            await other.context.close();
        }
    });
});

test.describe('Data Sync: mission page', () => {
    const created: Array<{ guid: string }> = [];

    test.beforeEach(async ({ readyMap }) => {
        await readyMap.activeMission.click();
        await expect(readyMap.panelTitle).toHaveText('Data Syncs');
    });

    test.afterEach(async ({ page }) => {
        for (const mission of created.splice(0)) {
            await apiDeleteMission(page, mission.guid);
        }
    });

    test('DS-22 mission page shows the tabs and owner controls on /info', async ({ page }) => {
        const missions = new MenuMissions(page);
        const mission = new MenuMission(page);
        const name = `QA-TEST-DS-22-${Date.now()}`;

        const { guid } = await createMissionViaForm(page, missions, {
            name,
            description: 'QA-TEST created by DS-22',
            channel: CHANNEL,
        });
        created.push({ guid });

        await expect(page).toHaveURL(new RegExp(`/menu/missions/${guid}/info`), { timeout: 15_000 });

        for (const label of Object.keys(MenuMission.TABS)) {
            await expect(mission.tab(label)).toBeVisible();
        }

        // Creator is the owner: Delete and More Options are available
        await expect(mission.deleteButton).toBeVisible();
        await expect(mission.moreOptions).toBeVisible();
    });

    test('DS-23 each tab opens its route', async ({ page }) => {
        const missions = new MenuMissions(page);
        const mission = new MenuMission(page);
        const name = `QA-TEST-DS-23-${Date.now()}`;

        const { guid } = await createMissionViaForm(page, missions, { name, channel: CHANNEL });
        created.push({ guid });
        await expect(page).toHaveURL(new RegExp(`/menu/missions/${guid}/info`), { timeout: 15_000 });

        // One mission for all tabs instead of one test per tab: creating 7 missions only to assert URLs is not worth the staging load
        for (const [label, route] of Object.entries(MenuMission.TABS)) {
            await mission.tab(label).click();
            await expect(page).toHaveURL(new RegExp(`/menu/missions/${guid}/${route}([/#?]|$)`));
        }
    });

    test('DS-24 Copy on the Description field puts the text on the clipboard', async ({ page, context }) => {
        const missions = new MenuMissions(page);
        const mission = new MenuMission(page);
        const name = `QA-TEST-DS-24-${Date.now()}`;
        const description = `QA-TEST DS-24 description ${Date.now()}`;

        const { guid } = await createMissionViaForm(page, missions, { name, description, channel: CHANNEL });
        created.push({ guid });
        await expect(page).toHaveURL(new RegExp(`/menu/missions/${guid}/info`), { timeout: 15_000 });

        await context.grantPermissions(['clipboard-read', 'clipboard-write']);

        await mission.descriptionBlock.hover();
        await mission.copyDescription.click();

        await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(description);
    });

    test('DS-25 Subscribe switches to Unsubscribe and lists the mission as subscribed', async ({ page, readyMap }) => {
        const missions = new MenuMissions(page);
        const mission = new MenuMission(page);
        const name = `QA-TEST-DS-25-${Date.now()}`;

        const seeded = await apiCreateMission(page, { name, group: [CHANNEL], description: 'QA-TEST DS-25' });
        created.push({ guid: seeded.guid });

        await openMissionFromAvailable(missions, name);
        await expect(mission.subscribeButton).toBeVisible();
        await expect(mission.inviteQr).toBeVisible();  // Sheet expects Invite QR only after subscribing; it is now always shown

        await mission.subscribeButton.click();
        await expect(mission.unsubscribeButton).toBeVisible({ timeout: 30_000 });
        await expect(mission.makeActive).toBeVisible();
        await expect(mission.inviteQr).toBeVisible();

        await mission.back.click();
        await expect(readyMap.panelTitle).toHaveText('Data Syncs');
        await missions.tab('Subscribed').click();
        await expect(missions.rows.filter({ hasText: name })).toBeVisible();
    });

    test('DS-26 Unsubscribe restores Subscribe and leaves the Subscribed tab', async ({ page, readyMap }) => {
        const missions = new MenuMissions(page);
        const mission = new MenuMission(page);
        const name = `QA-TEST-DS-26-${Date.now()}`;

        const seeded = await apiCreateMission(page, { name, group: [CHANNEL] });
        created.push({ guid: seeded.guid });

        await openMissionFromAvailable(missions, name);
        await mission.subscribeButton.click();
        await expect(mission.unsubscribeButton).toBeVisible({ timeout: 30_000 });

        await mission.unsubscribeButton.click();
        await expect(mission.subscribeButton).toBeVisible({ timeout: 30_000 });

        await mission.back.click();
        await expect(readyMap.panelTitle).toHaveText('Data Syncs');
        await missions.tab('Subscribed').click();
        await expect(missions.rows.filter({ hasText: name })).toHaveCount(0);
    });

    test('DS-27 Invite QR Code opens and closes the QR modal', async ({ page }) => {
        const missions = new MenuMissions(page);
        const mission = new MenuMission(page);
        const name = `QA-TEST-DS-27-${Date.now()}`;

        const { guid } = await createMissionViaForm(page, missions, { name, channel: CHANNEL });
        created.push({ guid });
        await expect(page).toHaveURL(new RegExp(`/menu/missions/${guid}/info`), { timeout: 15_000 });

        await mission.inviteQr.click();
        await expect(mission.qrModal).toBeVisible();
        await expect(mission.qrModal.getByText(`${name} Invite QR`)).toBeVisible();
        await expect(mission.qrImage).toBeVisible();

        await mission.qrClose.click();
        await expect(mission.qrModal).toBeHidden();
    });

    test('DS-28 Make Active shows Deactivate and the badge takes the mission name', async ({ page, readyMap }) => {
        const missions = new MenuMissions(page);
        const mission = new MenuMission(page);
        const name = `QA-TEST-DS-28-${Date.now()}`;

        const seeded = await apiCreateMission(page, { name, group: [CHANNEL] });
        created.push({ guid: seeded.guid });

        await openMissionFromAvailable(missions, name);
        await mission.subscribeButton.click();
        await expect(mission.makeActive).toBeVisible({ timeout: 30_000 });

        await mission.makeActive.click();
        await expect(mission.deactivate).toBeVisible({ timeout: 30_000 });
        await expect(page.getByText(name).first()).toBeVisible();
        await expect(readyMap.activeMission).toBeHidden();
    });

    test('DS-29 Deactivate restores Make Active and the No Active Mission badge', async ({ page, readyMap }) => {
        const missions = new MenuMissions(page);
        const mission = new MenuMission(page);
        const name = `QA-TEST-DS-29-${Date.now()}`;

        const seeded = await apiCreateMission(page, { name, group: [CHANNEL] });
        created.push({ guid: seeded.guid });

        await openMissionFromAvailable(missions, name);
        await mission.subscribeButton.click();
        await expect(mission.makeActive).toBeVisible({ timeout: 30_000 });
        await mission.makeActive.click();
        await expect(mission.deactivate).toBeVisible({ timeout: 30_000 });

        await mission.deactivate.click();
        await expect(mission.makeActive).toBeVisible({ timeout: 30_000 });
        await expect(readyMap.activeMission).toBeVisible();
    });

    test('DS-30 active mission badge icons open the matching mission tabs', async ({ page }) => {
        const missions = new MenuMissions(page);
        const mission = new MenuMission(page);
        const name = `QA-TEST-DS-30-${Date.now()}`;

        const seeded = await apiCreateMission(page, { name, group: [CHANNEL] });
        created.push({ guid: seeded.guid });

        await openMissionFromAvailable(missions, name);
        await mission.subscribeButton.click();
        await expect(mission.makeActive).toBeVisible({ timeout: 30_000 });
        await mission.makeActive.click();
        await expect(mission.deactivate).toBeVisible({ timeout: 30_000 });

        const shortcuts: Array<[string, string]> = [
            ['Layers', 'layers'],
            ['Changes', 'changes'],
            ['Users', 'users'],
            ['Logs', 'logs'],
            ['Chats', 'chats'],
            ['Files', 'contents'],
        ];
        for (const [title, route] of shortcuts) {
            await mission.badgeShortcut(title).click();
            await expect(page).toHaveURL(new RegExp(`/menu/missions/${seeded.guid}/${route}([/#?]|$)`));
        }
    });

    test('DS-31 More Options -> Download Archive starts a download', async ({ page }) => {
        const missions = new MenuMissions(page);
        const mission = new MenuMission(page);
        const name = `QA-TEST-DS-31-${Date.now()}`;

        const { guid } = await createMissionViaForm(page, missions, { name, channel: CHANNEL });
        created.push({ guid });
        await expect(page).toHaveURL(new RegExp(`/menu/missions/${guid}/info`), { timeout: 15_000 });

        const downloadPromise = page.waitForEvent('download', { timeout: 60_000 });
        await mission.moreOptions.click();
        await mission.downloadArchive.click();
        const download = await downloadPromise;
        expect(download.suggestedFilename()).toBeTruthy();
    });

    test('DS-33 Delete requires typing "Delete Data Sync" and removes the mission', async ({ page }) => {
        const missions = new MenuMissions(page);
        const mission = new MenuMission(page);
        const name = `QA-TEST-DS-33-${Date.now()}`;

        const { guid } = await createMissionViaForm(page, missions, { name, channel: CHANNEL });
        created.push({ guid });
        await expect(page).toHaveURL(new RegExp(`/menu/missions/${guid}/info`), { timeout: 15_000 });

        await mission.deleteButton.click();
        await expect(mission.deleteModal).toBeVisible();
        // Button stays disabled until the exact match text is typed.
        await expect(mission.deleteConfirmButton).toHaveClass(/disabled/);
        await mission.deleteConfirmInput.fill('Delete Data Sync');
        await expect(mission.deleteConfirmButton).not.toHaveClass(/disabled/);
        await mission.deleteConfirmButton.click();

        await expect(page).toHaveURL(/\/menu\/missions([?#]|$)/, { timeout: 30_000 });
        await missions.tab('Subscribed').click();
        await expect(missions.rows.filter({ hasText: name })).toHaveCount(0);
        await missions.showAvailable();
        await missions.filterInput.fill(name);
        await expect(missions.rows.filter({ hasText: name })).toHaveCount(0);

        created.pop();
    });
});

test.describe('Data Sync: multi-user', () => {
    const created: Array<{ guid: string }> = [];

    test.beforeEach(async ({ readyMap }) => {
        // Two full map loads per test
        test.setTimeout(240_000);
        await readyMap.activeMission.click();
        await expect(readyMap.panelTitle).toHaveText('Data Syncs');
    });

    test.afterEach(async ({ page }) => {
        for (const mission of created.splice(0)) {
            await apiDeleteMission(page, mission.guid);
        }
    });

    test('DS-34 inviting a user shows the invite modal on their session', async ({ page, browser }) => {
        const missions = new MenuMissions(page);
        const mission = new MenuMission(page);
        const name = `QA-TEST-DS-34-${Date.now()}`;

        const { guid } = await createMissionViaForm(page, missions, { name, channel: CHANNEL });
        created.push({ guid });
        await expect(page).toHaveURL(new RegExp(`/menu/missions/${guid}/info`), { timeout: 15_000 });

        const other = await openSecondUser(browser);
        try {
            await mission.tab('Users').click();
            // Invites match the invitee's connected client callsign, not the profile callsign
            const invitee = await apiGetClientCallsign(page, cloudtakUsername1());
            await mission.inviteUser.click();
            await mission.inviteUsername.fill(invitee);
            await mission.inviteSubmit.click();

            // Arrives over the websocket on the invitee's open session
            await expect(other.mission.inviteModal).toBeVisible({ timeout: 60_000 });
            await expect(other.mission.inviteModal.getByText('You have been invited to join the mission')).toBeVisible();
            await expect(other.mission.inviteModal.getByText(name)).toBeVisible();
            await expect(other.mission.inviteAccept).toBeVisible();
            await expect(other.mission.inviteIgnore).toBeVisible();
            // Sheet expects a Decline button; the modal labels it "Delete"
            await expect(other.mission.inviteDecline).toBeVisible();

            await other.mission.inviteIgnore.click();
            await expect(other.mission.inviteModal).toBeHidden();
        } finally {
            await other.context.close();
        }
    });

    test('DS-35 accepting an invite subscribes the invitee and lists them for the owner', async ({ page, browser }) => {
        const missions = new MenuMissions(page);
        const mission = new MenuMission(page);
        const name = `QA-TEST-DS-35-${Date.now()}`;

        const { guid } = await createMissionViaForm(page, missions, { name, channel: CHANNEL });
        created.push({ guid });
        await expect(page).toHaveURL(new RegExp(`/menu/missions/${guid}/info`), { timeout: 15_000 });

        const other = await openSecondUser(browser);
        try {
            await mission.tab('Users').click();
            const invitee = await apiGetClientCallsign(page, cloudtakUsername1());
            await mission.inviteUser.click();
            await mission.inviteUsername.fill(invitee);
            await mission.inviteSubmit.click();

            await expect(other.mission.inviteModal).toBeVisible({ timeout: 60_000 });
            await other.mission.inviteAccept.click();
            await expect(other.mission.inviteModal).toBeHidden();

            // Accept routes to the mission page with subscribe=true. the subscription completes there
            await expect(other.mission.unsubscribeButton).toBeVisible({ timeout: 30_000 });

            // Invitee side: mission is now in the Subscribed tab
            await other.map.activeMission.click();
            await other.missions.tab('Subscribed').click();
            await expect(other.missions.rows.filter({ hasText: name })).toBeVisible({ timeout: 30_000 });

            // Owner side: the invitee appears in the Users list
            await remountUsersTab(mission);
            await expect(page.getByText(new RegExp(cloudtakUsername1(), 'i'))).toBeVisible({ timeout: 30_000 });
        } finally {
            await other.context.close();
        }
    });

    test('DS-36 declining an invite leaves the invitee unsubscribed and clears the pending invite', async ({ page, browser }) => {
        const missions = new MenuMissions(page);
        const mission = new MenuMission(page);
        const name = `QA-TEST-DS-36-${Date.now()}`;

        const { guid } = await createMissionViaForm(page, missions, { name, channel: CHANNEL });
        created.push({ guid });
        await expect(page).toHaveURL(new RegExp(`/menu/missions/${guid}/info`), { timeout: 15_000 });

        const other = await openSecondUser(browser);
        try {
            await mission.tab('Users').click();
            const invitee = await apiGetClientCallsign(page, cloudtakUsername1());
            await mission.inviteUser.click();
            await mission.inviteUsername.fill(invitee);
            await mission.inviteSubmit.click();

            await expect(other.mission.inviteModal).toBeVisible({ timeout: 60_000 });
            // "Decline" per the sheet; the button is labeled Delete
            await other.mission.inviteDecline.click();
            await expect(other.mission.inviteModal).toBeHidden();

            await other.map.activeMission.click();
            await other.missions.tab('Subscribed').click();
            await expect(other.missions.rows.filter({ hasText: name })).toHaveCount(0);

            await remountUsersTab(mission);
            await expect(mission.pendingInvites).toBeHidden({ timeout: 30_000 });
        } finally {
            await other.context.close();
        }
    });

    test('DS-37 pending invite shows for the owner and revoking removes it', async ({ page }) => {
        const missions = new MenuMissions(page);
        const mission = new MenuMission(page);
        const name = `QA-TEST-DS-37-${Date.now()}`;

        const { guid } = await createMissionViaForm(page, missions, { name, channel: CHANNEL });
        created.push({ guid });
        await expect(page).toHaveURL(new RegExp(`/menu/missions/${guid}/info`), { timeout: 15_000 });

        await mission.tab('Users').click();
        await mission.inviteUser.click();
        await mission.inviteUsername.fill(USER2_CALLSIGN);
        await mission.inviteSubmit.click();

        await expect(mission.pendingInvites).toBeVisible({ timeout: 30_000 });
        await expect(mission.pendingInvites.locator('..')).toContainText('1');

        // Expand the pending list and revoke the invite
        await mission.pendingInvites.click();
        await expect(page.getByText(USER2_CALLSIGN)).toBeVisible();
        await page.locator('.cloudtak-accent [title="Delete"]').first().click();
        await mission.confirmDialog.locator('.btn-danger').click();

        await expect(mission.pendingInvites).toBeHidden({ timeout: 30_000 });
    });

    test('DS-38 a subscriber-added marker reaches the owner without reloading', async ({ page, browser }) => {
        const missions = new MenuMissions(page);
        const mission = new MenuMission(page);
        const name = `QA-TEST-DS-38-${Date.now()}`;
        const marker = `QA-TEST-DS-38-marker-${Date.now()}`;

        const { guid } = await createMissionViaForm(page, missions, { name, channel: CHANNEL });
        created.push({ guid });
        await expect(page).toHaveURL(new RegExp(`/menu/missions/${guid}/info`), { timeout: 15_000 });
        await mission.tab('Changes').click();

        const other = await openSecondUser(browser);
        try {
            await subscribeSecondUser(other, name);
            // Marker added through the API as the subscriber; the UI draw flow
            // is out of scope here, the sync propagation is what DS-38 asserts.
            const status = await apiSubmitMissionFeature(other.page, guid, marker);
            expect(status).toBe(200);

            // Owner sees the change arrive live on the open Changes tab.
            await expect(page.getByText(marker).first()).toBeVisible({ timeout: 60_000 });
        } finally {
            await other.context.close();
        }
    });

    test('DS-39 a subscriber description edit is visible to the owner after refresh', async ({ page, browser }) => {
        const missions = new MenuMissions(page);
        const name = `QA-TEST-DS-39-${Date.now()}`;
        const newDescription = `QA-TEST DS-39 edited ${Date.now()}`;

        const { guid } = await createMissionViaForm(page, missions, {
            name,
            description: 'QA-TEST DS-39 original',
            channel: CHANNEL,
        });
        created.push({ guid });
        await expect(page).toHaveURL(new RegExp(`/menu/missions/${guid}/info`), { timeout: 15_000 });

        const other = await openSecondUser(browser);
        try {
            await subscribeSecondUser(other, name);

            // Premise: a Subscriber can write (otherwise this is a sheet issue).
            const role = await apiGetMissionRole(other.page, guid);
            expect(role.permissions, `role ${role.type} should include MISSION_WRITE`).toContain('MISSION_WRITE');

            // The in-page role is fetched pre-subscribe; remount the view so
            // the description edit control picks up the refreshed role.
            await other.mission.tab('Users').click();
            await other.mission.tab('Metadata').click();

            // Subscriber edits the description in place (CopyField.vue).
            // Explicit timeouts so a stuck step fails fast and names itself.
            await other.mission.descriptionBlock.hover();
            await other.mission.editDescription.click({ timeout: 15_000 });
            await other.mission.descriptionBlock.locator('textarea').fill(newDescription, { timeout: 15_000 });
            await other.mission.doneEditing.click({ timeout: 15_000 });
            // Edit mode closes once the save settles.
            await expect(other.mission.descriptionBlock.locator('textarea')).toBeHidden({ timeout: 15_000 });

            // The save must persist server-side before the owner can see it.
            await expect.poll(async () => {
                const listed = (await apiListMissions(other.page)).find((m) => m.guid === guid);
                return listed?.description;
            }, { timeout: 30_000 }).toBe(newDescription);

            // Property changes do not stream live on 13.102: one refresh after
            // the server-side save settles shows the new text.
            await missions.refresh.click();
            await expect(page.getByText(newDescription)).toBeVisible({ timeout: 15_000 });
        } finally {
            await other.context.close();
        }
    });

    test('DS-40 a late joiner sees items added before they subscribed', async ({ page, browser }) => {
        const missions = new MenuMissions(page);
        const name = `QA-TEST-DS-40-${Date.now()}`;
        const marker = `QA-TEST-DS-40-marker-${Date.now()}`;

        const { guid } = await createMissionViaForm(page, missions, { name, channel: CHANNEL });
        created.push({ guid });
        await expect(page).toHaveURL(new RegExp(`/menu/missions/${guid}/info`), { timeout: 15_000 });

        // Owner adds history before the second user ever joins
        expect(await apiSubmitMissionFeature(page, guid, marker)).toBe(200);

        const other = await openSecondUser(browser);
        try {
            await subscribeSecondUser(other, name);
            await other.mission.tab('Changes').click();
            await expect(other.page.getByText(marker).first()).toBeVisible({ timeout: 30_000 });
        } finally {
            await other.context.close();
        }
    });

    test('DS-41 a read-only subscriber cannot edit, activate, or invite', async ({ page, browser }) => {
        const missions = new MenuMissions(page);
        const name = `QA-TEST-DS-41-${Date.now()}`;

        const { body, guid } = await createMissionViaForm(page, missions, {
            name,
            description: 'QA-TEST DS-41',
            channel: CHANNEL,
            role: 'Read-Only',
        });
        created.push({ guid });
        expect(body.defaultRole).toBe('MISSION_READONLY_SUBSCRIBER');

        const other = await openSecondUser(browser);
        try {
            await subscribeSecondUser(other, name);
            // No edit control on the description
            await other.mission.descriptionBlock.hover();
            await expect(other.mission.editDescription).toBeHidden();
            // Make Active is disabled without MISSION_WRITE
            await expect(other.mission.makeActive).toBeDisabled();
            // Invite User is hidden on the Users tab
            await other.mission.tab('Users').click();
            await expect(other.mission.inviteUser).toBeHidden();
        } finally {
            await other.context.close();
        }
    });

    test('DS-42 a direct API write from a read-only subscriber is rejected', async ({ page, browser }) => {
        const missions = new MenuMissions(page);
        const mission = new MenuMission(page);
        const name = `QA-TEST-DS-42-${Date.now()}`;
        const marker = `QA-TEST-DS-42-marker-${Date.now()}`;

        const { guid } = await createMissionViaForm(page, missions, {
            name,
            channel: CHANNEL,
            role: 'Read-Only',
        });
        created.push({ guid });

        const other = await openSecondUser(browser);
        try {
            await subscribeSecondUser(other, name);

            const status = await apiSubmitMissionFeature(other.page, guid, marker);
            expect(status).toBeGreaterThanOrEqual(400);

            // Nothing appears for the owner.
            await mission.tab('Changes').click();
            await expect(page.getByText(marker)).toHaveCount(0);
        } finally {
            await other.context.close();
        }
    });

    test('DS-43 a Subscriber sees no Delete and cannot change roles', async ({ page, browser }) => {
        const missions = new MenuMissions(page);
        const name = `QA-TEST-DS-43-${Date.now()}`;

        const { guid } = await createMissionViaForm(page, missions, { name, channel: CHANNEL });
        created.push({ guid });

        const other = await openSecondUser(browser);
        try {
            await subscribeSecondUser(other, name);

            // No Delete icon without MISSION_DELETE.
            await expect(other.mission.deleteButton).toBeHidden();

            // No Edit User pencil without MISSION_SET_ROLE or ownership.
            await other.mission.tab('Users').click();
            await expect(other.page.locator('.col-lg-12').first()).toBeVisible({ timeout: 15_000 });
            await expect(other.page.getByTitle('Edit User')).toHaveCount(0);
        } finally {
            await other.context.close();
        }
    });

    test.skip('DS-44 promoting Read-Only to Subscriber takes effect server-side; UI stays stale', async ({ page, browser }) => {
        const missions = new MenuMissions(page);
        const mission = new MenuMission(page);
        const name = `QA-TEST-DS-44-${Date.now()}`;
        const marker = `QA-TEST-DS-44-marker-${Date.now()}`;

        const { guid } = await createMissionViaForm(page, missions, {
            name,
            description: 'QA-TEST DS-44 original',
            channel: CHANNEL,
            role: 'Read-Only',
        });
        created.push({ guid });

        const other = await openSecondUser(browser);
        try {
            await subscribeSecondUser(other, name);
            await expect(other.mission.editDescription).toBeHidden();
            expect(await apiSubmitMissionFeature(other.page, guid, `${marker}-pre`)).toBeGreaterThanOrEqual(400);

            // Owner promotes the subscriber
            await mission.tab('Users').click();
            await mission.editUserButton(cloudtakUsername1()).click();
            await mission.roleSelect(cloudtakUsername1()).selectOption('MISSION_SUBSCRIBER');

            // The promotion persists and is effective: writes now succeed
            await expect.poll(async () => (await apiGetMissionRole(other.page, guid)).type, { timeout: 30_000 })
                .toBe('MISSION_SUBSCRIBER');
            await expect.poll(async () => apiSubmitMissionFeature(other.page, guid, marker), { timeout: 30_000 })
                .toBe(200);

            // BUG-0003: the subscriber's UI does not update to reflect the new role; a reload is required to see the edit control
            await other.page.reload();
            await other.map.waitUntilLoaded();
            await completeFirstLoginSetup(other.page, USER2_CALLSIGN);
            await expect(other.page.getByText('QA-TEST DS-44 original')).toBeVisible({ timeout: 30_000 });
            await expect(other.mission.editDescription).toBeHidden(); //once the bug is fixed, this should be visible
        } finally {
            await other.context.close();
        }
    });

    test.skip('DS-45 demoting a Subscriber to Read-Only removes write access', async ({ page, browser }) => {
        const missions = new MenuMissions(page);
        const mission = new MenuMission(page);
        const name = `QA-TEST-DS-45-${Date.now()}`;
        const marker = `QA-TEST-DS-45-marker-${Date.now()}`;

        // TAK Server refuses roles below the mission's defaultRole
        // ("validateRoleAssignment failed"), so the demotion floor is the
        // default: this mission uses Read-Only as the floor and B is first
        // promoted, then demoted back per the sheet.
        const { guid } = await createMissionViaForm(page, missions, {
            name,
            description: 'QA-TEST DS-45',
            channel: CHANNEL,
            role: 'Read-Only',
        });
        created.push({ guid });

        const other = await openSecondUser(browser);
        try {
            await subscribeSecondUser(other, name);

            // Promote B to Subscriber: writes become accepted.
            await mission.tab('Users').click();
            await mission.editUserButton(cloudtakUsername1()).click();
            await mission.roleSelect(cloudtakUsername1()).selectOption('MISSION_SUBSCRIBER');
            await expect.poll(async () => (await apiGetMissionRole(other.page, guid)).type, { timeout: 30_000 })
                .toBe('MISSION_SUBSCRIBER');
            expect(await apiSubmitMissionFeature(other.page, guid, `${marker}-pre`)).toBe(200);

            // Demote back to Read-Only (the sheet case).
            await remountUsersTab(mission);
            await mission.editUserButton(cloudtakUsername1()).click();
            const [roleResponse] = await Promise.all([
                page.waitForResponse((res) => res.url().includes(`/missions/${guid}/role`) && res.request().method() === 'PUT'),
                mission.roleSelect(cloudtakUsername1()).selectOption('MISSION_READONLY_SUBSCRIBER'),
            ]);
            expect(roleResponse.status()).toBe(200);
            await expect.poll(async () => (await apiGetMissionRole(other.page, guid)).type, { timeout: 30_000 })
                .toBe('MISSION_READONLY_SUBSCRIBER');

            // B has lost write access BUG-0004
            await expect.poll(async () => apiSubmitMissionFeature(other.page, guid, marker), { timeout: 30_000 })
                .toBeGreaterThanOrEqual(400);
        } finally {
            await other.context.close();
        }
    });

    test.skip('DS-46 removing a user ends their subscription', async ({ page, browser }) => {
        const missions = new MenuMissions(page);
        const mission = new MenuMission(page);
        const name = `QA-TEST-DS-46-${Date.now()}`;

        const { guid } = await createMissionViaForm(page, missions, { name, channel: CHANNEL });
        created.push({ guid });

        const other = await openSecondUser(browser);
        try {
            await subscribeSecondUser(other, name);

            await mission.tab('Users').click();
            await mission.removeUserButton(cloudtakUsername1()).click();
            await mission.confirmDialog.locator('.btn-danger').click();
            await expect(mission.userRow(cloudtakUsername1())).toHaveCount(0, { timeout: 30_000 });

            // The removed user's local state still lists the mission as
            // subscribed; opening it from the Subscribed tab resyncs and
            // shows Subscribe again.
            await other.map.activeMission.click();
            await other.missions.tab('Subscribed').click();
            await other.missions.rows.filter({ hasText: name }).click();
            await expect(other.mission.subscribeButton).toBeVisible({ timeout: 30_000 });

            // Sheet expects the mission to leave the Subscribed tab; on 13.102
            // the removed user keeps a stale local entry there even after the
            // resync above - raise with Nicholas.
            await other.mission.back.click();
            await other.missions.tab('Subscribed').click();
            await expect(other.missions.rows.filter({ hasText: name })).toBeVisible();
        } finally {
            await other.context.close();
        }
    });

    test('DS-47 owner deleting the mission removes it for subscribers', async ({ page, browser }) => {
        const missions = new MenuMissions(page);
        const mission = new MenuMission(page);
        const name = `QA-TEST-DS-47-${Date.now()}`;

        const { guid } = await createMissionViaForm(page, missions, { name, channel: CHANNEL });
        created.push({ guid });

        const other = await openSecondUser(browser);
        try {
            await subscribeSecondUser(other, name);

            // Owner deletes through the UI
            await mission.deleteButton.click();
            await mission.deleteConfirmInput.fill('Delete Data Sync');
            await mission.deleteConfirmButton.click();
            await expect(page).toHaveURL(/\/menu\/missions([?#]|$)/, { timeout: 30_000 });
            created.pop();

            // Gone from the subscriber's Available tab (server truth)
            await other.map.activeMission.click();
            await other.missions.showAvailable();
            await Promise.all([
                other.page.waitForResponse((res) => res.url().includes('/api/marti/mission?')),
                other.missions.refresh.click(),
            ]);
            await expect(other.missions.rows.filter({ hasText: name })).toHaveCount(0);

            // And eventually from their Subscribed tab as local state syncs
            await expect.poll(async () => {
                await other.missions.tab('Subscribed').click();
                const gone = await other.missions.rows.filter({ hasText: name }).count() === 0;
                if (!gone) await other.missions.tab('Available').click();
                return gone;
            }, { timeout: 60_000, intervals: [5000] }).toBe(true);
        } finally {
            await other.context.close();
        }
    });

    test.skip('DS-48 a subscriber catches up on items added while offline', async ({ page, browser }) => {
        const missions = new MenuMissions(page);
        const name = `QA-TEST-DS-48-${Date.now()}`;
        const marker = `QA-TEST-DS-48-marker-${Date.now()}`;

        const { guid } = await createMissionViaForm(page, missions, { name, channel: CHANNEL });
        created.push({ guid });

        const other = await openSecondUser(browser);
        try {
            await subscribeSecondUser(other, name);
            await other.mission.tab('Changes').click();
            await other.context.setOffline(true);
            expect(await apiSubmitMissionFeature(page, guid, marker)).toBe(200);
            await other.context.setOffline(false);

            // BUG-0006: the subscriber's UI does not update to reflect the new change; a reload is required to see it
            await other.page.reload();
            await other.map.waitUntilLoaded();
            await completeFirstLoginSetup(other.page, USER2_CALLSIGN);
            await expect(other.page.getByText(marker).first()).toBeVisible({ timeout: 30_000 });
        } finally {
            await other.context.close();
        }
    });
});

test.describe('Data Sync: password-protected', () => {
    const created: Array<{ guid: string; password: string }> = [];

    test.beforeEach(async ({ readyMap }) => {
        test.setTimeout(240_000);
        await readyMap.activeMission.click();
        await expect(readyMap.panelTitle).toHaveText('Data Syncs');
    });

    test.afterEach(async ({ page }) => {
        for (const mission of created.splice(0)) {
            await apiDeleteMission(page, mission.guid, { password: mission.password });
        }
    });

    async function seedLockedMission(page: Page, id: string): Promise<{ guid: string; name: string; password: string }> {
        const name = `QA-TEST-${id}-${Date.now()}`;
        const password = `QA-TEST-pw-${Date.now()}`;
        const mission = await apiCreateMission(page, {
            name,
            group: [CHANNEL],
            description: `QA-TEST ${id}`,
            password,
        });
        created.push({ guid: mission.guid, password });
        return { guid: mission.guid, name, password };
    }

    test('DS-50 the correct password opens the mission', async ({ page, browser }) => {
        const seeded = await seedLockedMission(page, 'DS-50');

        const other = await openSecondUser(browser);
        try {
            await other.map.activeMission.click();
            await other.missions.showAvailable();
            await other.missions.filterInput.fill(seeded.name);
            await other.missions.rows.filter({ hasText: seeded.name }).click();

            await other.missions.rowPasswordInput(seeded.name).fill(seeded.password);
            await other.missions.rowUnlockButton(seeded.name).click();

            await expect(other.page).toHaveURL(new RegExp(`/menu/missions/${seeded.guid}/info`), { timeout: 30_000 });
            await expect(other.mission.subscribeButton).toBeVisible({ timeout: 30_000 });
        } finally {
            await other.context.close();
        }
    });

    test('DS-51 a wrong password shows Invalid Password and stays closed', async ({ page, browser }) => {
        const seeded = await seedLockedMission(page, 'DS-51');

        const other = await openSecondUser(browser);
        try {
            await other.map.activeMission.click();
            await other.missions.showAvailable();
            await other.missions.filterInput.fill(seeded.name);
            await other.missions.rows.filter({ hasText: seeded.name }).click();

            await other.missions.rowPasswordInput(seeded.name).fill('QA-TEST-wrong-password');
            await other.missions.rowUnlockButton(seeded.name).click();

            await expect(other.page.getByText('Invalid Password')).toBeVisible({ timeout: 30_000 });
            await expect(other.page).toHaveURL(/\/menu\/missions([?#]|$)/);
        } finally {
            await other.context.close();
        }
    });

    test('DS-52 an empty password does not open the mission', async ({ page, browser }) => {
        const seeded = await seedLockedMission(page, 'DS-52');

        const other = await openSecondUser(browser);
        try {
            await other.map.activeMission.click();
            await other.missions.showAvailable();
            await other.missions.filterInput.fill(seeded.name);
            await other.missions.rows.filter({ hasText: seeded.name }).click();

            // Submit with the field left empty
            await expect(other.missions.rowPasswordInput(seeded.name)).toBeVisible();
            await other.missions.rowUnlockButton(seeded.name).click();

            // Observed behavior: same inline rejection as a wrong password
            await expect(other.page.getByText('Invalid Password')).toBeVisible({ timeout: 30_000 });
            await expect(other.missions.rowPasswordInput(seeded.name)).toBeVisible();
            await expect(other.page).toHaveURL(/\/menu\/missions([?#]|$)/);
        } finally {
            await other.context.close();
        }
    });

    test.skip('DS-53 the creator is also asked for the password', async ({ page }) => {
        const missions = new MenuMissions(page);
        const seeded = await seedLockedMission(page, 'DS-53');

        await missions.showAvailable();
        await missions.filterInput.fill(seeded.name);
        await missions.rows.filter({ hasText: seeded.name }).click();

        // BUG-0002
        await expect(missions.rowPasswordInput(seeded.name)).toBeVisible({ timeout: 15_000 });

        // The correct password still gets the creator in.
        await missions.rowPasswordInput(seeded.name).fill(seeded.password);
        await missions.rowUnlockButton(seeded.name).click();
        await expect(page).toHaveURL(new RegExp(`/menu/missions/${seeded.guid}/info`), { timeout: 30_000 });
    });
});

test.describe('Data Sync: negatives and boundaries', () => {
    const created: Array<{ guid: string; password?: string }> = [];

    test.beforeEach(async ({ readyMap }) => {
        await readyMap.activeMission.click();
        await expect(readyMap.panelTitle).toHaveText('Data Syncs');
    });

    test.afterEach(async ({ page }) => {
        for (const mission of created.splice(0)) {
            await apiDeleteMission(page, mission.guid, { password: mission.password });
        }
    });

    test('DS-54 an empty name blocks creation and sends no request', async ({ page }) => {
        const missions = new MenuMissions(page);
        const posts = trackMissionCreates(page);

        await missions.openCreateModal();
        await missions.createMission.click();

        await expect(missions.modal.getByText('Cannot be empty')).toBeVisible();
        await expect(missions.modal).toBeVisible();
        expect(posts()).toBe(0);
    });

    test('DS-55 a whitespace-only name is not blocked client-side', async ({ page }) => {
        const missions = new MenuMissions(page);
        const name = '   ';
        const posts = trackMissionCreates(page);

        await missions.openCreateModal();
        await missions.field('Name').fill(name);
        await missions.channelsFilter.fill(CHANNEL);
        await missions.channelOption(CHANNEL).click();
        await missions.createMission.click();

        // Sheet expects this treated like an empty name; the client regex
        // allows whitespace, so the request goes out and the server answers.
        await expect.poll(() => posts(), { timeout: 15_000 }).toBe(1);
        await expect(missions.errorDialog).toBeVisible({ timeout: 30_000 });
        await missions.errorDialog.locator('button.btn-close').click();

        await deleteMissionsNamed(page, name.trim());
        await deleteMissionsNamed(page, name);
    });

    test.skip('DS-56 a 300+ character name is rejected by the server with a 500', async ({ page, pageErrors }) => {
        const missions = new MenuMissions(page);
        const name = `QA-TEST-DS-56-${Date.now()}-${'x'.repeat(300)}`;

        await missions.openCreateModal();
        await missions.field('Name').fill(name);
        await missions.channelsFilter.fill(CHANNEL);
        await missions.channelOption(CHANNEL).click();

        // BUG-0007
        const [response] = await Promise.all([
            page.waitForResponse((res) => res.url().endsWith('/api/marti/mission') && res.request().method() === 'POST'),
            missions.createMission.click(),
        ]);
        expect(response.status()).toBe(500);
        await expect(missions.errorDialog).toBeVisible({ timeout: 30_000 });
        await missions.errorDialog.locator('button.btn-close').click();

        expect((await apiListMissions(page)).filter((m) => m.name === name)).toHaveLength(0);
        expect(pageErrors).toEqual([]);
    });

    test.skip('DS-57 special characters render as plain text and run no script', async ({ page, pageErrors }) => {
        const missions = new MenuMissions(page);
        const name = `QA-TEST-DS-57-${Date.now()}`;
        const description = `100% 'quoted' QA-TEST DS-57`;

        const dialogs: string[] = [];
        page.on('dialog', async (dialog) => {
            dialogs.push(dialog.message());
            await dialog.dismiss();
        });

        await missions.openCreateModal();

        // Script tags in the name are blocked client-side outright.
        await missions.field('Name').fill('<script>alert(1)</script>');
        await expect(missions.modal.getByText('Contains Invalid Character')).toBeVisible();

        // BUG-0008
        await missions.field('Name').fill(name);
        await missions.field('Description').fill(description);
        await missions.channelsFilter.fill(CHANNEL);
        await missions.channelOption(CHANNEL).click();

        const [response] = await Promise.all([
            page.waitForResponse((res) => res.url().endsWith('/api/marti/mission') && res.request().method() === 'POST'),
            missions.createMission.click(),
        ]);
        expect(response.ok()).toBe(true);
        const mission = await response.json() as { guid: string };
        created.push({ guid: mission.guid });

        await expect(page).toHaveURL(new RegExp(`/menu/missions/${mission.guid}/info`), { timeout: 15_000 });
        await expect(page.getByText(description)).toBeVisible();
        expect(dialogs).toEqual([]);
        expect(pageErrors).toEqual([]);
    });

    test('DS-58 a duplicate name is rejected and no second mission appears', async ({ page }) => {
        const missions = new MenuMissions(page);
        const name = `QA-TEST-DS-58-${Date.now()}`;

        const seeded = await apiCreateMission(page, { name, group: [CHANNEL] });
        created.push({ guid: seeded.guid });

        await missions.openCreateModal();
        await missions.field('Name').fill(name);
        await missions.channelsFilter.fill(CHANNEL);
        await missions.channelOption(CHANNEL).click();
        await missions.createMission.click();

        await expect(missions.errorDialog).toBeVisible({ timeout: 30_000 });
        await missions.errorDialog.locator('button.btn-close').click();

        expect((await apiListMissions(page)).filter((m) => m.name === name)).toHaveLength(1);
    });

    test.skip('DS-59 Password Protected with an empty password creates an unprotected mission', async ({ page }) => {
        const missions = new MenuMissions(page);
        const name = `QA-TEST-DS-59-${Date.now()}`;

        await missions.openCreateModal();
        await missions.field('Name').fill(name);
        await missions.channelsFilter.fill(CHANNEL);
        await missions.channelOption(CHANNEL).click();
        await missions.advancedOptions.click();
        await missions.passwordToggle.setChecked(true);

        // BUG-0009: the client allows an empty password to be submitted, and the server treats it as unprotected
        const [response] = await Promise.all([
            page.waitForResponse((res) => res.url().endsWith('/api/marti/mission') && res.request().method() === 'POST'),
            missions.createMission.click(),
        ]);
        expect(response.ok()).toBe(true);
        const mission = await response.json() as { guid: string };
        created.push({ guid: mission.guid });

        const listed = (await apiListMissions(page)).find((m) => m.guid === mission.guid);
        expect(listed?.passwordProtected).toBe(false);
    });

    test('DS-60 double-clicking Create Mission sends a single request', async ({ page }) => {
        const missions = new MenuMissions(page);
        const name = `QA-TEST-DS-60-${Date.now()}`;
        const posts = trackMissionCreates(page);

        await missions.openCreateModal();
        await missions.field('Name').fill(name);
        await missions.channelsFilter.fill(CHANNEL);
        await missions.channelOption(CHANNEL).click();
        await missions.createMission.dblclick();

        await expect(page).toHaveURL(/\/menu\/missions\/.+/, { timeout: 30_000 });
        expect(posts()).toBe(1);

        const matches = (await apiListMissions(page)).filter((m) => m.name === name);
        expect(matches).toHaveLength(1);
        const first = matches[0];
        if (first) created.push({ guid: first.guid });
    });

    test('DS-61 a failing create keeps the modal open with its values', async ({ page }) => {
        const missions = new MenuMissions(page);
        const name = `QA-TEST-DS-61-${Date.now()}`;

        await page.route('**/api/marti/mission', async (route) => {
            if (route.request().method() === 'POST') {
                return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'QA mock 500' }) });
            }
            return route.fallback();
        });

        await missions.openCreateModal();
        await missions.field('Name').fill(name);
        await missions.channelsFilter.fill(CHANNEL);
        await missions.channelOption(CHANNEL).click();
        await missions.createMission.click();

        await expect(missions.errorDialog).toBeVisible({ timeout: 30_000 });
        await missions.errorDialog.locator('button.btn-close').click();

        await expect(missions.modal).toBeVisible();
        await expect(missions.field('Name')).toHaveValue(name);
        await page.unroute('**/api/marti/mission');
    });

    test('DS-62 a failing list shows an error state and stays usable', async ({ page, pageErrors }) => {
        const missions = new MenuMissions(page);

        await page.route('**/api/marti/mission?*', (route) => route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ message: 'QA mock 500' }),
        }));

        // Not showAvailable(): with the list failing there are no rows to wait for
        await missions.tab('Available').click();
        await expect(page.getByText('Generic Error')).toBeVisible({ timeout: 30_000 });
        // Panel stays usable: tabs still switch
        await missions.tab('Subscribed').click();
        await expect(missions.tabRadio('Subscribed')).toBeChecked();
        expect(pageErrors).toEqual([]);
        await page.unroute('**/api/marti/mission?*');
    });

    test('DS-63 wrong delete confirmation text keeps the button disabled', async ({ page }) => {
        const missions = new MenuMissions(page);
        const mission = new MenuMission(page);
        const name = `QA-TEST-DS-63-${Date.now()}`;

        const { guid } = await createMissionViaForm(page, missions, { name, channel: CHANNEL });
        created.push({ guid });
        await expect(page).toHaveURL(new RegExp(`/menu/missions/${guid}/info`), { timeout: 15_000 });

        await mission.deleteButton.click();
        await expect(mission.deleteModal).toBeVisible();

        for (const wrong of ['delete data sync', 'Delete', 'Delete Data Sync ']) {
            await mission.deleteConfirmInput.fill(wrong);
            await expect(mission.deleteConfirmButton).toHaveClass(/disabled/);
        }

        await mission.deleteConfirmInput.fill('Delete Data Sync');
        await expect(mission.deleteConfirmButton).not.toHaveClass(/disabled/);
        await mission.deleteModal.locator('.btn-close').click();
        await expect(mission.deleteModal).toBeHidden();
    });

    test('DS-64 cancelling the delete modal leaves the mission in place', async ({ page }) => {
        const missions = new MenuMissions(page);
        const mission = new MenuMission(page);
        const name = `QA-TEST-DS-64-${Date.now()}`;

        const { guid } = await createMissionViaForm(page, missions, { name, channel: CHANNEL });
        created.push({ guid });
        await expect(page).toHaveURL(new RegExp(`/menu/missions/${guid}/info`), { timeout: 15_000 });

        await mission.deleteButton.click();
        await expect(mission.deleteModal).toBeVisible();
        await mission.deleteModal.locator('.btn-close').click();
        await expect(mission.deleteModal).toBeHidden();

        await expect(page).toHaveURL(new RegExp(`/menu/missions/${guid}/info`));
        expect((await apiListMissions(page)).some((m) => m.guid === guid)).toBe(true);
    });

    test('DS-65 an unknown mission GUID shows an error with the map shell intact', async ({ page, map, pageErrors }) => {
        await page.goto('/menu/missions/00000000-0000-0000-0000-000000000000');
        await map.waitUntilLoaded();
        await completeFirstLoginSetup(page, 'Zori');

        await expect(page.getByText('Generic Error')).toBeVisible({ timeout: 30_000 });
        await expect(map.canvas.first()).toBeVisible();
        expect(pageErrors).toEqual([]);
    });

    test('DS-66 a deleted mission deep link shows an error, not stale data', async ({ page, map }) => {
        const name = `QA-TEST-DS-66-${Date.now()}`;
        const seeded = await apiCreateMission(page, { name, group: [CHANNEL] });
        await apiDeleteMission(page, seeded.guid);

        await page.goto(`/menu/missions/${seeded.guid}`);
        await map.waitUntilLoaded();
        await completeFirstLoginSetup(page, 'Zori');

        await expect(page.getByText('Generic Error')).toBeVisible({ timeout: 30_000 });
        await expect(page.getByText(name)).toHaveCount(0);
    });

    test('DS-67 rapid Subscribe/Unsubscribe ends in a consistent state', async ({ page, readyMap }) => {
        const missions = new MenuMissions(page);
        const mission = new MenuMission(page);
        const name = `QA-TEST-DS-67-${Date.now()}`;

        const seeded = await apiCreateMission(page, { name, group: [CHANNEL] });
        created.push({ guid: seeded.guid });

        await openMissionFromAvailable(missions, name);

        // Five alternating clicks as fast as each button appears: ends subscribed.
        for (let i = 0; i < 2; i += 1) {
            await mission.subscribeButton.click();
            await expect(mission.unsubscribeButton).toBeVisible({ timeout: 30_000 });
            await mission.unsubscribeButton.click();
            await expect(mission.subscribeButton).toBeVisible({ timeout: 30_000 });
        }
        await mission.subscribeButton.click();
        await expect(mission.unsubscribeButton).toBeVisible({ timeout: 30_000 });
        // The Subscribed tab agrees with the final button state.
        await mission.back.click();
        await expect(readyMap.panelTitle).toHaveText('Data Syncs');
        await missions.tab('Subscribed').click();
        await expect(missions.rows.filter({ hasText: name })).toBeVisible();
    });

    test('DS-68 special characters in the filter do not throw', async ({ page, pageErrors }) => {
        const missions = new MenuMissions(page);
        await missions.showAvailable();
        const all = await missions.names();

        for (const input of ['.*', '[', '%']) {
            await missions.filterInput.fill(input);
            await expect(missions.noMatch).toBeVisible();
        }

        await missions.filterInput.fill('');
        await expect.poll(() => missions.names()).toEqual(all);
        expect(pageErrors).toEqual([]);
    });

    test('DS-69 offline actions error visibly instead of failing silently', async ({ page, context }) => {
        test.setTimeout(240_000);
        const missions = new MenuMissions(page);
        const mission = new MenuMission(page);
        const name = `QA-TEST-DS-69-${Date.now()}`;

        const { guid } = await createMissionViaForm(page, missions, { name, channel: CHANNEL });
        created.push({ guid });
        await expect(page).toHaveURL(new RegExp(`/menu/missions/${guid}/info`), { timeout: 15_000 });

        try {
            await mission.tab('Users').click();
            await context.setOffline(true);
            await expect(page.getByText(`You're Offline`)).toBeVisible({ timeout: 30_000 });

            await mission.back.click();
            await missions.createSync.click();
            await expect(missions.errorDialog).toBeVisible({ timeout: 30_000 });
            await missions.errorDialog.locator('button.btn-close').click();
        } finally {
            await context.setOffline(false);
        }
    });
});

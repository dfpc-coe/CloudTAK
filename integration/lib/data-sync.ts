import type { Page, Browser, BrowserContext } from '@playwright/test';
import { expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage.ts';
import { MapPage } from '../pages/MapPage.ts';
import { MenuMissions } from '../pages/MenuMissions.ts';
import { MenuMission } from '../pages/MenuMission.ts';
import { completeFirstLoginSetup } from './fixtures.ts';
import { cloudtakUsername1, cloudtakPassword1 } from './env.ts';
import { ensureChannelActive } from './session.ts';
import { apiDeleteMission, apiListMissions } from './missions.ts';
import type { MissionCreateBody } from './missions.ts';

export const CHANNEL = 'DEMO - Demonstrations';
// Callsign set for the secondary account during its first-login onboarding
export const USER2_CALLSIGN = 'QA Integrations 2';

export type CreateFormOpts = {
    name: string;
    description?: string;
    template?: string;
    channel: string;
    role?: 'Read-Only' | 'Subscriber' | 'Owner';
    password?: string;
};

// Fill and submit the Create Mission form, capturing POST /api/marti/mission
export async function createMissionViaForm(page: Page, missions: MenuMissions, opts: CreateFormOpts): Promise<{ body: MissionCreateBody; guid: string }> {
    await missions.openCreateModal();
    await missions.field('Name').fill(opts.name);
    if (opts.description) await missions.field('Description').fill(opts.description);

    if (opts.template) {
        await expect(missions.templateCards.first()).toBeVisible();
        await missions.templateCard(opts.template).click();
    }

    await missions.channelsFilter.fill(opts.channel);
    await missions.channelOption(opts.channel).click();

    if (opts.role || opts.password) {
        await missions.advancedOptions.click();
        if (opts.role) await missions.defaultRole.selectOption(opts.role);
        if (opts.password) {
            await missions.passwordToggle.setChecked(true);
            await missions.passwordInput.fill(opts.password);
        }
    }

    const [request] = await Promise.all([
        page.waitForRequest((req) => req.method() === 'POST' && req.url().endsWith('/api/marti/mission')),
        missions.createMission.click(),
    ]);

    const response = await request.response();
    if (!response) throw new Error('POST /api/marti/mission got no response');
    expect(response.ok(), `mission create should succeed, got HTTP ${response.status()}`).toBe(true);

    const mission = await response.json() as { guid: string };
    return { body: request.postDataJSON() as MissionCreateBody, guid: mission.guid };
}

// Open an API-created (not yet subscribed) mission from the Available tab
export async function openMissionFromAvailable(missions: MenuMissions, name: string): Promise<void> {
    await missions.showAvailable();
    await missions.filterInput.fill(name);
    const row = missions.rows.filter({ hasText: name });
    await expect(row).toBeVisible();
    await row.click();
}

export type SecondUser = {
    context: BrowserContext;
    page: Page;
    map: MapPage;
    missions: MenuMissions;
    mission: MenuMission;
};

// Log the secondary account into its own browser context (separate session)
export async function openSecondUser(browser: Browser): Promise<SecondUser> {
    const context = await browser.newContext();
    const page = await context.newPage();
    const login = new LoginPage(page);
    await login.goto();
    await login.login(cloudtakUsername1(), cloudtakPassword1());
    const map = new MapPage(page);
    await map.waitUntilLoaded();
    await completeFirstLoginSetup(page, USER2_CALLSIGN);
    await ensureChannelActive(page, CHANNEL);
    return { context, page, map, missions: new MenuMissions(page), mission: new MenuMission(page) };
}

// Second user subscribes to a mission by name from the Available tab
export async function subscribeSecondUser(user: SecondUser, name: string): Promise<void> {
    await user.map.activeMission.click();
    await openMissionFromAvailable(user.missions, name);
    await user.mission.subscribeButton.click();
    await expect(user.mission.unsubscribeButton).toBeVisible({ timeout: 30_000 });
}

// Remount the Users tab so invites/subscriptions refetch (MissionUsers.vue only loads them on mount)
export async function remountUsersTab(mission: MenuMission): Promise<void> {
    await mission.tab('Metadata').click();
    await mission.tab('Users').click();
}

// Count POST /api/marti/mission requests from now on DS-54, DS-60
export function trackMissionCreates(page: Page): () => number {
    let count = 0;
    page.on('request', (req) => {
        if (req.method() === 'POST' && req.url().endsWith('/api/marti/mission')) count += 1;
    });
    return () => count;
}

// Delete any mission with this exact name safety net for discovery tests
export async function deleteMissionsNamed(page: Page, name: string): Promise<void> {
    for (const mission of (await apiListMissions(page)).filter((m) => m.name === name)) {
        await apiDeleteMission(page, mission.guid);
    }
}

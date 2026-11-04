import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';
import type { MapPage } from './MapPage.ts';

// Shape of /api/marti/package responses (PackageResponse in api/stateless/routes/types.ts).
// username is optional in the schema, but both panes render it unconditionally, so tests treat it as required.
export type Package = {
    uid: string;
    name: string;
    hash: string;
    size: number;
    username: string;
    created: string;
    keywords: string[];
    expiration: null | number | string;
    channels: string[];
};

export type PackageList = {
    total: number;
    items: Package[];
};

// Matches the list call only, not /api/marti/package/{uid}.
const LIST_URL = /\/api\/marti\/package(\?|$)/;

// Matches the detail call only, not the list.
const DETAIL_URL = /\/api\/marti\/package\/[^/?]+(\?|$)/;

export class MenuPackages {
    readonly page: Page;
    readonly panel: Locator;
    readonly title: Locator;
    readonly createButton: Locator;
    readonly refreshButton: Locator;
    readonly filterInput: Locator;
    readonly channelNotice: Locator;
    readonly noChannels: Locator;
    readonly items: Locator;
    readonly empty: Locator;
    readonly error: Locator;
    readonly createModal: Locator;
    readonly createName: Locator;
    readonly createFileInput: Locator;
    readonly createChannels: Locator;
    readonly createSubmit: Locator;
    readonly createClose: Locator;
    // Detail view (one package opened from the list).
    readonly deleteButton: Locator;
    readonly downloadButton: Locator;
    readonly name: Locator;
    readonly createdLine: Locator;
    readonly importButton: Locator;
    readonly shareButton: Locator;

    static readonly ROUTE = '/menu/packages';

    // "Created <timediff>" line under the package name; the template renders leading whitespace.
    static readonly CREATED = /^\s*Created (~?\d+ (second|minute|hour|day|month|year)s? ago|in ~?\d+ \w+)\s*$/;

    // Smallest valid zip (EOCD record only); staged locally, never uploaded.
    static readonly EMPTY_ZIP = Buffer.from('504b0506' + '00'.repeat(18), 'hex');

    // Keywords the UI hides from the chips.
    static readonly HIDDEN_KEYWORDS = ['missionpackage'];

    // timediff.ts output, past or future.
    static readonly AGE = /^(~?\d+ (second|minute|hour|day|month|year)s? ago|in ~?\d+ \w+)$/;

    constructor(page: Page) {
        this.page = page;
        this.panel = page.getByRole('menubar');
        this.title = this.panel.locator('.cloudtak-header .strong');
        this.createButton = this.panel.getByTitle('Create Package');
        this.refreshButton = this.panel.getByTitle('Refresh');
        this.filterInput = this.panel.getByPlaceholder('Filter');
        this.channelNotice = this.panel.getByText('Data Packages are only shown if the channel in which they belong is turned on');
        this.noChannels = this.panel.getByText('No Channels are active');
        this.items = this.panel.locator('.standard-item');
        this.empty = this.panel.getByText('No Packages');
        this.error = this.panel.getByText('Packages Error');
        this.createModal = page.getByRole('dialog').filter({ hasText: 'Create Data Package' });
        this.createName = this.createModal.getByPlaceholder('Name');
        this.createFileInput = this.createModal.locator('input[type="file"]');
        this.createChannels = this.createModal.locator('.col-12.cursor-pointer');
        this.createSubmit = this.createModal.getByRole('button', { name: 'Create', exact: true });
        this.createClose = this.createModal.locator('.btn-close');
        this.deleteButton = this.panel.getByTitle('Delete');
        this.downloadButton = this.panel.getByTitle('Download Asset');
        this.name = this.panel.locator('h2');
        this.createdLine = this.panel.locator('h2 + span');
        this.importButton = this.panel.getByRole('button', { name: 'Import Package' });
        this.shareButton = this.panel.getByRole('button', { name: 'Share Package' });
    }

    // Open from the right-side menu and return the list the panel rendered.
    async openFromMenu(map: MapPage): Promise<PackageList> {
        return this.captureList(() => map.menuItem('Data Packages').click());
    }

    // Deep link straight to the panel (faster setup for tests that don't cover opening it).
    async goto(): Promise<PackageList> {
        return this.captureList(async () => { await this.page.goto(MenuPackages.ROUTE); });
    }

    // Type into the filter box and return the list response fetched for exactly that filter.
    async filter(text: string): Promise<PackageList> {
        const listed = this.page.waitForResponse((r) => LIST_URL.test(r.url())
            && r.request().method() === 'GET'
            && new URL(r.url()).searchParams.get('filter') === text);
        await this.filterInput.fill(text);
        const res = await listed;
        expect(res.status(), 'filtered package list request should succeed').toBe(200);
        return (await res.json()) as PackageList;
    }

    async refresh(): Promise<PackageList> {
        return this.captureList(() => this.refreshButton.click());
    }

    // Browser back from a package detail; SPA navigation, so no permissions modal reappears.
    async back(): Promise<PackageList> {
        return this.captureList(async () => { await this.page.goBack(); });
    }

    async openCreate(): Promise<void> {
        await this.createButton.click();
        await expect(this.createModal).toBeVisible();
    }

    // Stage an in-memory zip in the create modal; autoupload is off, so nothing hits the server.
    async stageCreateFile(name: string): Promise<void> {
        await this.createFileInput.setInputFiles({ name, mimeType: 'application/zip', buffer: MenuPackages.EMPTY_ZIP });
        await expect(this.createModal.getByText(name)).toBeVisible();
    }

    itemName(row: Locator): Locator {
        return row.locator('.fw-semibold');
    }

    itemAge(row: Locator): Locator {
        return row.locator('.text-secondary.small > div').first();
    }

    itemOwner(row: Locator): Locator {
        return row.locator('.text-secondary.small > div').last();
    }

    static visibleKeywords(pkg: Package): string[] {
        return pkg.keywords.filter((k) => k && !MenuPackages.HIDDEN_KEYWORDS.includes(k.trim()));
    }

    // Uppercase detail field label ("Created By", "Channels", "Expiry", ...).
    fieldLabel(label: string): Locator {
        return this.panel.locator('small', { hasText: new RegExp(`^${label}$`) });
    }

    // Value <p> next to a detail field label (works for Created By, Package Hash, Size).
    fieldValue(label: string): Locator {
        return this.panel
            .locator('div', { has: this.page.locator('small', { hasText: new RegExp(`^${label}$`) }) })
            .last()
            .locator('p');
    }

    // Mirrors formatBytes() in MenuPackage.vue for the Size field.
    static formatBytes(size: number | string | undefined): string {
        if (!size) return '—';

        const bytes = Number(size);
        if (!Number.isFinite(bytes) || bytes < 0) return `${size} B`;

        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        let value = bytes;
        let unitIndex = 0;
        while (value >= 1024 && unitIndex < units.length - 1) {
            value /= 1024;
            unitIndex++;
        }

        const precision = value >= 10 || unitIndex === 0 ? 0 : 1;
        return `${value.toFixed(precision)} ${units[unitIndex]}`;
    }

    private async captureList(action: () => Promise<void>): Promise<PackageList> {
        const listed = this.page.waitForResponse((r) => LIST_URL.test(r.url()) && r.request().method() === 'GET');
        await action();
        const res = await listed;
        expect(res.status(), 'package list request should succeed').toBe(200);
        return (await res.json()) as PackageList;
    }

    async captureDetail(action: () => Promise<void>): Promise<Package> {
        const fetched = this.page.waitForResponse((r) => DETAIL_URL.test(r.url()) && r.request().method() === 'GET');
        await action();
        const res = await fetched;
        expect(res.status(), 'package detail request should succeed').toBe(200);
        return (await res.json()) as Package;
    }
}
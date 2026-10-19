import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';

export class MenuMissions {
    readonly page: Page;
    readonly createSync: Locator;
    readonly refresh: Locator;
    readonly tabs: Locator;
    readonly filterInput: Locator;
    readonly filterButton: Locator;
    readonly sortButton: Locator;
    readonly sortOptions: Locator;
    readonly rows: Locator;
    readonly rowNames: Locator;
    readonly noMatch: Locator;
    readonly noSubscribed: Locator;
    readonly modal: Locator;
    readonly errorDialog: Locator;
    readonly modalTitle: Locator;
    readonly modalClose: Locator;
    readonly searchTemplates: Locator;
    readonly closeTemplateSearch: Locator;
    readonly templateSearchInput: Locator;
    readonly templateCards: Locator;
    readonly channelsFilter: Locator;
    readonly advancedOptions: Locator;
    readonly newKeyword: Locator;
    readonly passwordToggle: Locator;
    readonly passwordInput: Locator;
    readonly defaultRole: Locator;
    readonly createMission: Locator;

    constructor(page: Page) {
        this.page = page;
        this.createSync = page.getByTitle('Create Sync');
        this.refresh = page.getByTitle('Refresh');
        this.tabs = page.getByRole('group').filter({ has: page.getByRole('radio', { name: 'Available' }) });
        this.filterInput = page.getByPlaceholder('Filter data syncs');
        this.filterButton = page.getByTitle('Filter');
        this.sortButton = page.getByTitle('Sort');
        this.sortOptions = page.locator('.tabler-dropdown__menu .dropdown-item');
        this.rows = page.locator('.standard-item');
        this.rowNames = this.rows.locator('.fw-semibold');
        this.noMatch = page.getByText('No data syncs match your filter');
        this.noSubscribed = page.getByText('No subscribed data syncs');
        this.modal = page.getByRole('dialog').filter({ has: page.getByText('Create Mission') });
        this.errorDialog = page.getByRole('dialog').filter({ hasText: 'Website Error' });
        this.modalTitle = this.modal.locator('.modal-header').getByText('Create Mission');
        this.modalClose = this.modal.locator('button.btn-close');
        this.searchTemplates = this.modal.getByTitle('Search Templates');
        this.closeTemplateSearch = this.modal.getByTitle('Close Search');
        this.templateSearchInput = this.modal.getByPlaceholder('Search Templates...');
        this.templateCards = this.modal.locator('.card');
        this.channelsFilter = this.modal.getByPlaceholder('Filter Channels...');
        this.advancedOptions = this.modal.getByText('Advanced Options');
        this.newKeyword = this.modal.getByTitle('Add keyword');
        this.passwordToggle = this.modal.locator('.form-switch input[type="checkbox"]');
        this.passwordInput = this.field('Password');
        this.defaultRole = this.field('Default Role');
        this.createMission = this.modal.getByRole('button', { name: 'Create Mission' });
    }

    templateCard(name: string): Locator {
        return this.templateCards.filter({ hasText: name });
    }

    channelOption(name: string): Locator {
        return this.modal.locator('.cursor-pointer').filter({ hasText: name }).first();
    }

    field(label: string): Locator {
        return this.modal
            .locator(`xpath=.//span[text()="${label}"]/ancestor::div[contains(@class, "row")][1]`)
            .locator('input, select');
    }

    async openCreateModal(): Promise<void> {
        await this.createSync.click();
        await expect(this.modal).toBeVisible();
    }

    async templateCardNames(): Promise<string[]> {
        return (await this.templateCards.locator('.small').allTextContents()).map((name) => name.trim());
    }

    tab(label: 'Subscribed' | 'Available'): Locator {
        return this.tabs.locator('label').filter({ hasText: label });
    }

    tabRadio(label: 'Subscribed' | 'Available'): Locator {
        return this.tabs.getByRole('radio', { name: label });
    }

    sortOption(label: string): Locator {
        return this.sortOptions.filter({ hasText: label });
    }

    rowPasswordInput(name: string): Locator {
        return this.rows.filter({ hasText: name }).locator('input[type="password"]');
    }

    rowUnlockButton(name: string): Locator {
        return this.rows.filter({ hasText: name }).getByRole('button', { name: 'Unlock' });
    }

    async names(): Promise<string[]> {
        return (await this.rowNames.allTextContents()).map((name) => name.trim());
    }

    async waitForList(): Promise<void> {
        await expect(this.rows.first()).toBeVisible({ timeout: 30_000 });
    }

    async showAvailable(): Promise<void> {
        await this.tab('Available').click();
        await expect(this.tabRadio('Available')).toBeChecked();
        await this.waitForList();
    }
}

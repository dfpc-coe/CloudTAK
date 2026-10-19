import type { Page, Locator } from '@playwright/test';

export class MenuMission {
    readonly page: Page;
    readonly deleteButton: Locator;
    readonly moreOptions: Locator;
    readonly downloadArchive: Locator;
    readonly exportGeoJSON: Locator;
    readonly exportKML: Locator;
    readonly subscribeButton: Locator;
    readonly unsubscribeButton: Locator;
    readonly makeActive: Locator;
    readonly deactivate: Locator;
    readonly inviteQr: Locator;
    readonly qrModal: Locator;
    readonly qrImage: Locator;
    readonly qrClose: Locator;
    readonly deleteModal: Locator;
    readonly deleteConfirmInput: Locator;
    readonly deleteConfirmButton: Locator;
    readonly back: Locator;
    readonly descriptionBlock: Locator;
    readonly copyDescription: Locator;
    readonly editDescription: Locator;
    readonly doneEditing: Locator;
    readonly inviteUser: Locator;
    readonly inviteUsername: Locator;
    readonly inviteSubmit: Locator;
    readonly pendingInvites: Locator;
    readonly confirmDialog: Locator;
    readonly inviteModal: Locator;
    readonly inviteAccept: Locator;
    readonly inviteIgnore: Locator;
    readonly inviteDecline: Locator;

    static readonly TABS: Record<string, string> = {
        'Metadata': 'info',
        'Layers': 'layers',
        'Users': 'users',
        'Changes': 'changes',
        'Logs': 'logs',
        'Files': 'contents',
        'Chats': 'chats',
    };

    constructor(page: Page) {
        this.page = page;
        this.deleteButton = page.getByTitle('Delete', { exact: true });
        this.moreOptions = page.getByTitle('More Options');
        this.downloadArchive = page.getByText('Download Archive');
        this.exportGeoJSON = page.getByText('Export GeoJSON');
        this.exportKML = page.getByText('Export KML');
        this.subscribeButton = page.getByRole('button', { name: 'Subscribe' });
        this.unsubscribeButton = page.getByRole('button', { name: 'Unsubscribe' });
        this.makeActive = page.getByRole('button', { name: 'Make Active' });
        this.deactivate = page.getByRole('button', { name: 'Deactivate' });
        this.inviteQr = page.getByRole('button', { name: 'Invite QR Code' });
        this.qrModal = page.getByRole('dialog').filter({ hasText: 'Invite QR' });
        this.qrImage = this.qrModal.locator('img.invite-qr-image');
        this.qrClose = this.qrModal.locator('button.btn-close');
        this.deleteModal = page.getByRole('dialog').filter({ hasText: 'to confirm' });
        this.deleteConfirmInput = this.deleteModal.getByPlaceholder('Delete Data Sync');
        this.deleteConfirmButton = this.deleteModal.locator('.btn-danger');
        this.back = page.getByTitle('Back');
        this.descriptionBlock = page.locator('xpath=//small[text()="Description"]/..');
        this.copyDescription = this.descriptionBlock.locator('[title="Copy"], [title="Copied"]').first();
        this.editDescription = this.descriptionBlock.locator('[title="Edit Field"]');
        this.doneEditing = page.locator('[title="Done Editing"]');

        this.inviteUser = page.getByTitle('Invite User');
        this.inviteUsername = page.getByPlaceholder('Username');
        this.inviteSubmit = page.getByRole('button', { name: 'Invite', exact: true });
        this.pendingInvites = page.getByText('Pending Invites');
        this.confirmDialog = page.getByRole('dialog').filter({ hasText: 'Deletion Confirmation' });

        this.inviteModal = page.getByRole('dialog').filter({ hasText: 'Mission Invitation' });
        this.inviteAccept = this.inviteModal.getByRole('button', { name: 'Accept' });
        this.inviteIgnore = this.inviteModal.getByRole('button', { name: 'Ignore' });
        this.inviteDecline = this.inviteModal.getByRole('button', { name: 'Delete' });
    }

    tab(label: string): Locator {
        return this.page.locator(`[role="group"] span[title="${label}"]`);
    }

    badgeShortcut(title: string): Locator {
        return this.page.getByRole('button', { name: title, exact: true });
    }

    userRow(username: string): Locator {
        return this.page.locator('.col-lg-12').filter({ hasText: username });
    }

    editUserButton(username: string): Locator {
        return this.userRow(username).getByTitle('Edit User');
    }

    roleSelect(username: string): Locator {
        return this.userRow(username).locator('select.form-select');
    }

    removeUserButton(username: string): Locator {
        return this.userRow(username).locator('[title="Delete"]');
    }
}

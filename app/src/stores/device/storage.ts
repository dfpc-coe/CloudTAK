import { PermissionQuery } from './shared.ts';
import type { DevicePermissionContext } from './types.ts';

export class StoragePermission {
    constructor(private readonly context: DevicePermissionContext) {}

    async refreshStatus(): Promise<void> {
        if (!('storage' in navigator) || !navigator.storage?.persisted) {
            this.context.setPermissionStatus('storage', 'unsupported');
            return;
        }

        const status = await PermissionQuery.queryPermissionStatus('persistent-storage', 'Failed to query persistent storage permission status');
        if (status) {
            this.context.setPermissionStatus('storage', status.state);
            return;
        }

        try {
            const persisted = await navigator.storage.persisted();
            this.context.setPermissionStatus('storage', persisted ? 'granted' : 'prompt');
        } catch (err) {
            console.warn('Failed to check persistent storage status', err);
            this.context.setPermissionStatus('storage', 'unknown');
        }
    }

    async request(): Promise<void> {
        if (!('storage' in navigator) || !navigator.storage?.persist) {
            this.context.setPermissionStatus('storage', 'unsupported');
            return;
        }

        try {
            const persisted = await navigator.storage.persist();
            this.context.setPermissionStatus('storage', persisted ? 'granted' : 'denied');
        } finally {
            await this.refreshStatus();
        }
    }
}
/*
* AtlasSync - Synchronization Manager for CloudTAK
*
* Once the map has initialized and finished loading, performs a full
* synchronization of data types (overlays, features, iconsets, contacts,
* channels, chatrooms, etc.) with the TAK Server via the src/base/* standard
* classes.
*
* Targeted syncs are also triggered when another of the user's connected
* clients mutates a data type via the API - the server broadcasts a `sync`
* message over the WebSocket which AtlasConnection passes to this manager.
*
* INVARIANT: Everything a sync triggers - the handlers in syncEvent()/
* runFullSync() and any main-thread reaction to the Sync_* messages they
* post - must apply server state with local-only operations (GET + IndexedDB
* + map mutations). A sync handler that POSTs/PATCHes back to an API route
* which broadcasts sync events (see lib/connection-events.ts) makes the
* user's clients resync each other in an infinite loop. Use the local-only
* escape hatches (skipSave, skipNetwork, direct map property application)
* when applying synced state.
*/

import type Atlas from './atlas.ts';
import { std } from '../std.ts';
import type { Feature, ProfileOverlay } from '../types.ts';
import { WorkerMessageType } from '../base/events.ts';
// base/overlay.ts (OverlayManager) cannot be imported here - it pulls in the
// map store & maplibre-gl which touch `document` at import time and break the
// worker. The worker-safe sync shared with OverlayManager lives in overlay-sync.
import { syncOverlays, applyOverlay, removeOverlay } from '../base/overlay-sync.ts';
import IconsetManager from '../base/iconset.ts';
import ContactManager from '../base/contact.ts';
import GroupManager from '../base/group.ts';
import Chatroom from '../base/chatroom.ts';
import MissionTemplate from '../base/mission-template.ts';
import ProfileConfig from '../base/profile.ts';
import ServerManager from '../base/server.ts';

export enum SyncDataType {
    Overlay = 'overlay',
    Feature = 'feature',
    Mission = 'mission',
    Basemap = 'basemap',
    Iconset = 'iconset',
    Profile = 'profile',
    Contact = 'contact',
    Chatroom = 'chatroom',
    Group = 'group',
    MissionTemplate = 'mission-template',
    Server = 'server',
}

export enum SyncEventAction {
    Create = 'create',
    Update = 'update',
    Delete = 'delete',
}

export type SyncEvent = {
    type: SyncDataType;
    action: SyncEventAction;
    id?: string | number;

    // Inline copy of the mutated resource sent by the server so it can be
    // applied directly without a follow-up API fetch
    body?: unknown;
}

// How long to wait for additional events before processing the queue,
// coalescing bursts of events from bulk operations into a single sync
const EVENT_DEBOUNCE_MS = 50;

export default class AtlasSync {
    atlas: Atlas;

    // Set once the initial full sync has been requested (post map load)
    started: boolean;

    isSyncing: boolean;
    lastSync: number | null;
    lastErrors: string[];

    private current: Promise<void> | null;
    private queue: SyncEvent[];
    private timer: ReturnType<typeof setTimeout> | undefined;
    private flushing: Promise<void>;

    constructor(atlas: Atlas) {
        this.atlas = atlas;

        this.started = false;
        this.isSyncing = false;
        this.lastSync = null;
        this.lastErrors = [];

        this.current = null;
        this.queue = [];
        this.timer = undefined;
        this.flushing = Promise.resolve();
    }

    /**
     * Called by the UI once the map has initialized and finished loading,
     * kicking off the initial full synchronization with the TAK Server
     */
    async start(): Promise<void> {
        if (this.started) return;
        this.started = true;

        await this.fullSync();
    }

    /**
     * Perform a full synchronization of all data types. Concurrent calls
     * coalesce onto the in-flight sync.
     */
    async fullSync(): Promise<void> {
        if (this.current) return this.current;

        this.current = this.runFullSync()
            .finally(() => {
                this.current = null;
            });

        return this.current;
    }

    /**
     * Entry point for sync events received over the WebSocket from
     * AtlasConnection - queues the event and processes it after a short
     * debounce so bursts of events result in a single sync per data type
     */
    async event(event: SyncEvent): Promise<void> {
        if (!event || !event.type) return;

        this.queue.push(event);

        if (this.timer === undefined) {
            this.timer = setTimeout(() => {
                this.timer = undefined;

                // Chain flushes so overlapping batches can't process events
                // for the same resource out of order
                this.flushing = this.flushing
                    .then(() => this.flush())
                    .catch((err) => {
                        console.error('AtlasSync: Failed to process sync events', err);
                    });
            }, EVENT_DEBOUNCE_MS);
        }
    }

    destroy(): void {
        if (this.timer !== undefined) {
            clearTimeout(this.timer);
            this.timer = undefined;
        }

        this.queue = [];
        this.started = false;
    }

    private async runFullSync(): Promise<void> {
        this.isSyncing = true;
        this.lastErrors = [];

        this.atlas.postMessage({ type: WorkerMessageType.Sync_Start });

        const tasks: Array<[SyncDataType, () => Promise<unknown>]> = [
            [SyncDataType.Overlay, () => syncOverlays()],
            [SyncDataType.Feature, () => this.atlas.db.loadArchive()],
            [SyncDataType.Iconset, () => IconsetManager.sync()],
            [SyncDataType.Contact, () => ContactManager.sync()],
            [SyncDataType.Group, () => GroupManager.sync()],
            [SyncDataType.Chatroom, () => Chatroom.sync()],
            [SyncDataType.MissionTemplate, () => MissionTemplate.sync()],
            [SyncDataType.Profile, () => ProfileConfig.sync({ refresh: true })],
            [SyncDataType.Server, () => ServerManager.sync()],
        ];

        const results = await Promise.allSettled(tasks.map(([, task]) => task()));

        for (let i = 0; i < results.length; i++) {
            const result = results[i];
            if (result.status === 'rejected') {
                const message = `${tasks[i][0]}: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`;
                console.error(`AtlasSync: Failed to sync ${message}`);
                this.lastErrors.push(message);
            }
        }

        this.isSyncing = false;
        this.lastSync = Date.now();

        this.atlas.postMessage({
            type: WorkerMessageType.Sync_Complete,
            body: {
                errors: this.lastErrors
            }
        });
    }

    private async flush(): Promise<void> {
        // NOTE: Targeted syncs deliberately do NOT wait on an in-flight full
        // sync. runFullSync() fans out ~9 network calls to the TAK server with
        // no timeout; blocking here means a single slow/hung endpoint (marti
        // group/contacts, etc.) would stall every feature event indefinitely
        // and features would never propagate between clients. Each targeted
        // handler is independent and db.add() is idempotent, so running
        // concurrently with the full sync is safe.
        const events = this.queue.splice(0);
        if (!events.length) return;

        // Dedupe events so bulk operations only trigger a single sync per
        // (type, action, id) triple. The latest event wins so a burst of
        // updates to the same resource applies the newest inline payload.
        const deduped = new Map<string, SyncEvent>();
        for (const event of events) {
            deduped.set(`${event.type}:${event.action}:${event.id ?? ''}`, event);
        }

        for (const event of deduped.values()) {
            try {
                await this.syncEvent(event);

                this.atlas.postMessage({
                    type: WorkerMessageType.Sync_Update,
                    body: event
                });
            } catch (err) {
                console.error(`AtlasSync: Failed to sync ${event.type}`, err);
            }
        }
    }

    private async syncEvent(event: SyncEvent): Promise<void> {
        if (event.type === SyncDataType.Overlay || event.type === SyncDataType.Mission || event.type === SyncDataType.Basemap) {
            if (event.action === SyncEventAction.Delete && event.id !== undefined) {
                await removeOverlay(Number(event.id));
            } else if (event.body) {
                // The event carries the mutated overlay inline - apply it
                // directly and skip the full overlay list, which is slow due
                // to the server's per-overlay existence checks
                await applyOverlay(event.body as ProfileOverlay);
            } else {
                await syncOverlays();
            }
        } else if (event.type === SyncDataType.Feature) {
            if (event.action === SyncEventAction.Delete && event.id !== undefined) {
                await this.atlas.db.remove(String(event.id), { skipNetwork: true });
            } else if (event.body) {
                // The event carries the mutated feature inline - apply it
                // directly with no follow-up fetch. db.add() is idempotent and
                // skipSave prevents a PUT back to the API, so a client
                // receiving its own change simply re-applies an identical
                // feature (a no-op) while other clients render it.
                await this.atlas.db.add(event.body as Feature, { skipSave: true });
            } else if (event.id !== undefined) {
                // No inline payload - fetch just the mutated feature
                await this.syncFeature(String(event.id));
            } else {
                // Bulk feature change with no id (e.g. delete-all) - reconcile
                // the full archive (loadArchive prunes server-deleted features)
                await this.atlas.db.loadArchive();
            }
        } else if (event.type === SyncDataType.Iconset) {
            await IconsetManager.sync();
        } else if (event.type === SyncDataType.Contact) {
            await ContactManager.sync();
        } else if (event.type === SyncDataType.Group) {
            await GroupManager.sync();
        } else if (event.type === SyncDataType.Chatroom) {
            await Chatroom.sync();
        } else if (event.type === SyncDataType.MissionTemplate) {
            await MissionTemplate.sync();
        } else if (event.type === SyncDataType.Profile) {
            await ProfileConfig.sync({ refresh: true });
        } else if (event.type === SyncDataType.Server) {
            await ServerManager.sync();
        } else {
            console.warn(`AtlasSync: Unknown sync data type: ${event.type}`);
        }
    }

    /**
     * Fetch a single archived feature by id from the API and apply it to the
     * local store. If the feature no longer exists (deleted between the event
     * firing and this fetch) it is removed locally instead.
     */
    private async syncFeature(id: string): Promise<void> {
        let feat: Feature;

        try {
            feat = await std(`/api/profile/feature/${encodeURIComponent(id)}`, {
                token: this.atlas.token
            }) as Feature;
        } catch (err) {
            const status = (err as { body?: { status?: number } }).body?.status;

            if (status === 404) {
                // The feature was deleted after the event was emitted. Drop it
                // locally without a network delete (skipNetwork) so we don't
                // re-broadcast a sync event.
                await this.atlas.db.remove(id, { skipNetwork: true }).catch(() => undefined);
                return;
            }

            // Anything else (network blip, auth, 5xx) must surface - silently
            // swallowing it makes features appear to never propagate
            throw err;
        }

        await this.atlas.db.add(feat, { skipSave: true });
    }
}

/*
* ConnectionStore - Maintain the WebSocket connection with CloudTAK Server
*/

import { WorkerMessageType, LocationState } from '../base/events.ts';
import type { WorkerMessage } from '../base/events.ts';
import * as Comlink from 'comlink';
import AtlasProfile from './atlas-profile.ts';
import type { ProfileLocationState } from './atlas-profile.ts';
import AtlasDatabase from './atlas-database.ts';
import AtlasConnection from './atlas-connection.ts';
import AtlasSync from './atlas-sync.ts';
import { CloudTAKTransferHandler } from '../base/handler.ts';
import { db, recoverDatabase } from '../database.ts';

export default class Atlas {
    channel!: BroadcastChannel;

    token: string;
    username: string;
    initialized: boolean;

    db = Comlink.proxy(new AtlasDatabase(this));
    conn = Comlink.proxy(new AtlasConnection(this));
    profile = Comlink.proxy(new AtlasProfile(this));
    sync = Comlink.proxy(new AtlasSync(this));

    constructor() {
        this.token = '';
        this.username = '';
        this.initialized = false;

        this.openChannel();
    }

    /**
     * (Re)create the BroadcastChannel to the main thread. A WebView
     * suspension can wedge the existing channel such that WebKit throws
     * DataCloneError on every post, even for plain payloads, so recover()
     * replaces it alongside the database connection.
     */
    openChannel(): void {
        if (this.channel) {
            try {
                this.channel.close();
            } catch (err) {
                console.error(err);
            }
        }

        this.channel = new BroadcastChannel('cloudtak');
        this.channel.onmessage = (event: MessageEvent<WorkerMessage>) => {
            const msg = event.data;
            if (!msg || !msg.type) return;

            if (msg.type === WorkerMessageType.Profile_Location_Coordinates) {
                // Only process GPS coordinates if not in manual location mode
                if (this.profile.location.source !== LocationState.Preset) {
                    this.postMessage({
                        type: WorkerMessageType.Profile_Location_Source,
                        body: {
                            source: LocationState.Live
                        }
                    })

                    this.profile.location = {
                        source: LocationState.Live,
                        ...msg.body
                    } as ProfileLocationState;
                }
            } else if (msg.type === WorkerMessageType.Feature_Update) {
                this.db.add(msg.body, { authored: true });
            } else if (msg.type === WorkerMessageType.Profile_Update) {
                this.profile.update(msg.body);
            }
        }
    }

    async postMessage(msg: WorkerMessage): Promise<void> {
        try {
            this.channel.postMessage(msg);
        } catch (err) {
            // A wedged channel throws on every post - replace it and retry
            console.error('BroadcastChannel post failed, recreating channel:', err);
            this.openChannel();
            this.channel.postMessage(msg);
        }
    }

    /**
     * Called by the main thread on app resume - workers receive no
     * visibility events to recover their own IndexedDB connection.
     */
    async recover(): Promise<void> {
        this.openChannel();
        await recoverDatabase();
    }

    async init(authToken: string) {
        // Only skip if we know initialization has successfully completed before
        if (this.initialized) return;

        this.token = authToken;

        try {
            await db.config.put({ key: 'token', value: authToken });

            this.username = await this.profile.init();

            await this.conn.connect(this.username)

            await this.db.init();

            this.initialized = true;
        } catch (error) {
            // Reset state so a future init call can retry after a transient failure
            this.conn.destroy();
            this.profile.destroy();
            this.sync.destroy();
            this.token = '';
            this.username = '';
            this.initialized = false;
            throw error;
        }
    }

    destroy() {
        this.conn.destroy();
        this.profile.destroy();
        this.sync.destroy();
        this.initialized = false;
        this.token = '';
        this.username = '';
        this.channel.close();
    }
}

const atlas = new Atlas()

new CloudTAKTransferHandler(Comlink.transferHandlers, false);

Comlink.expose(Comlink.proxy(atlas));
self.postMessage({ type: WorkerMessageType.Atlas_Ready } satisfies WorkerMessage);

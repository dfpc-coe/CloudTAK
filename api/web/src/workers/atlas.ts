/*
* ConnectionStore - Maintain the WebSocket connection with CloudTAK Server
*/

import { WorkerMessageType, LocationState } from '../utils/events.ts';
import type { WorkerMessage } from '../utils/events.ts';
import * as Comlink from 'comlink';
import AtlasProfile from './atlas-profile.ts';
import type { ProfileLocationState } from './atlas-profile.ts';
import AtlasDatabase from './atlas-database.ts';
import AtlasConnection from './atlas-connection.ts';
import AtlasSync from './atlas-sync.ts';
import AtlasTiles from './atlas-tiles.ts';
import { CloudTAKTransferHandler } from './handler.ts';
import { db, probeDatabase, suspendDatabase, resumeDatabase } from '../database.ts';

// A storage process that is not answering never will - surface it in
// seconds rather than burning the main thread's 30s init budget
const DB_PROBE_TIMEOUT_MS = 4000;

export default class Atlas {
    channel: BroadcastChannel;

    token: string;
    username: string;
    initialized: boolean;
    suspended: boolean;

    db = Comlink.proxy(new AtlasDatabase(this));
    conn = Comlink.proxy(new AtlasConnection(this));
    profile = Comlink.proxy(new AtlasProfile(this));
    sync = Comlink.proxy(new AtlasSync(this));
    tiles = Comlink.proxy(new AtlasTiles(this));

    constructor() {
        this.channel = new BroadcastChannel('cloudtak');
        this.token = '';
        this.username = '';
        this.initialized = false;
        this.suspended = false;

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
        return this.channel.postMessage(msg);
    }

    async init(authToken: string) {
        // Only skip if we know initialization has successfully completed before
        if (this.initialized) return;

        this.token = authToken;

        try {
            await probeDatabase(DB_PROBE_TIMEOUT_MS);

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

    /**
     * Native background: keep the WebSocket, stop every IndexedDB touch.
     * iOS kills WKWebView's storage process under a backgrounded app and a
     * request caught in flight wedges storage for the life of the WebView.
     * Features that arrive meanwhile stay in memory and persist on resume.
     */
    suspend(): void {
        if (this.suspended) return;
        this.suspended = true;

        this.profile.pauseTimer();
        suspendDatabase();
    }

    async resume(): Promise<void> {
        if (!this.suspended) return;
        this.suspended = false;

        resumeDatabase();

        if (!this.initialized) return;

        try {
            const flushed = await this.db.flushDeferred();
            if (flushed) console.log(`Persisted ${flushed} feature(s) received while backgrounded`);
        } catch (err) {
            console.error('Failed to persist features received while backgrounded', err);
        }

        // Sync events that arrived while suspended could not be applied and
        // are not replayed - resync the same way a reconnect does
        if (this.sync.started) {
            this.sync.fullSync().catch((err: unknown) => {
                console.error('Failed to resync after resume', err);
            });
        }

        this.profile.setupTimer();
    }

    destroy() {
        this.conn.destroy();
        this.profile.destroy();
        this.sync.destroy();
        this.suspended = false;
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

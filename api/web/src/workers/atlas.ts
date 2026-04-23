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
import AtlasIcons from './atlas-icons.ts';
import { CloudTAKTransferHandler } from '../base/handler.ts';
import { db } from '../base/database.ts';

export default class Atlas {
    channel: BroadcastChannel;

    token: string;
    username: string;
    initialized: boolean;

    db = Comlink.proxy(new AtlasDatabase(this));
    conn = Comlink.proxy(new AtlasConnection(this));
    profile = Comlink.proxy(new AtlasProfile(this));
    icons = Comlink.proxy(new AtlasIcons(this));

    constructor() {
        this.channel = new BroadcastChannel('cloudtak');
        this.token = '';
        this.username = '';
        this.initialized = false;

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
            await db.config.put({ key: 'token', value: authToken });

            this.username = await this.profile.init();

            // Hydrate iconsets before opening the WebSocket so features pushed
            // by the server can resolve their icons immediately rather than
            // racing the icon download.
            try {
                await this.icons.hydrate();
            } catch (err) {
                console.error('Failed to hydrate iconsets before connect', err);
            }

            await this.conn.connect(this.username)

            await this.db.init();

            this.initialized = true;
        } catch (error) {
            // Reset state so a future init call can retry after a transient failure
            this.conn.destroy();
            this.profile.destroy();
            this.token = '';
            this.username = '';
            this.initialized = false;
            throw error;
        }
    }

    destroy() {
        this.conn.destroy();
        this.profile.destroy();
        this.initialized = false;
        this.token = '';
        this.username = '';
        this.channel.close();
    }
}

const atlas = new Atlas()

new CloudTAKTransferHandler(Comlink.transferHandlers, false);

Comlink.expose(Comlink.proxy(atlas));

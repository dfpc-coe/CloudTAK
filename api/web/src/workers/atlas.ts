/*
* ConnectionStore - Maintain the WebSocket connection with CloudTAK Server
*/

import { WorkerMessageType, LocationState } from '../base/events.ts';
import type { WorkerMessage } from '../base/events.ts';
import * as Comlink from 'comlink';
import AtlasProfile from './atlas-profile.ts';
import type { ProfileLocation } from './atlas-profile.ts';
import AtlasTeam from './atlas-team.ts';
import AtlasDatabase from './atlas-database.ts';
import AtlasConnection from './atlas-connection.ts';
import { CloudTAKTransferHandler } from '../base/handler.ts';

export default class Atlas {
    channel: BroadcastChannel;
    sync: BroadcastChannel;

    token: string;

    db = Comlink.proxy(new AtlasDatabase(this));
    team = Comlink.proxy(new AtlasTeam(this));
    conn = Comlink.proxy(new AtlasConnection(this));
    profile = Comlink.proxy(new AtlasProfile(this));

    constructor() {
        this.channel = new BroadcastChannel('cloudtak');
        this.sync = new BroadcastChannel('sync');
        this.token = '';

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
                    } as ProfileLocation;
                }
            }
        }
    }

    async postMessage(msg: WorkerMessage): Promise<void> {
        return this.channel.postMessage(msg);
    }

    async init(authToken: string) {
        if (this.token) return;

        this.token = authToken;

        const username = await this.profile.init();
        await this.conn.connect(username)

        await Promise.all([
            this.db.init(),
            this.team.init()
        ])
    }

    destroy() {
        this.conn.destroy();
    }
}

const atlas = new Atlas()

new CloudTAKTransferHandler(atlas, Comlink.transferHandlers, false);

Comlink.expose(Comlink.proxy(atlas));

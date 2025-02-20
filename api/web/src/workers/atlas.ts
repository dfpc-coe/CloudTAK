/*
* ConnectionStore - Maintain the WebSocket connection with CloudTAK Server
*/

import * as Comlink from 'comlink';
import { TransferHandler } from '../base/events.ts';
import AtlasProfile from './atlas-profile.ts';
import AtlasDatabase from './atlas-database.ts';
import AtlasConnection from './atlas-connection.ts';

export type {
    AtlasProfile,
    AtlasDatabase,
    AtlasConnection
};

export default class Atlas {
    channel: BroadcastChannel;

    token: string;

    db = Comlink.proxy(new AtlasDatabase(this));
    conn = Comlink.proxy(new AtlasConnection(this));
    profile = Comlink.proxy(new AtlasProfile(this));

    constructor() {
        this.channel = new BroadcastChannel('cloudtak');
        this.token = '';
    }

    async init(authToken: string) {
        this.token = authToken;

        const username = await this.profile.init();
        await this.conn.connect(username)

        await this.db.init();
    }

    destroy() {
        this.conn.destroy();
    }
}

const atlas = new Atlas()

const transfer = new TransferHandler(atlas);
Comlink.transferHandlers.set("cot", transfer.cot);

Comlink.expose(Comlink.proxy(atlas));

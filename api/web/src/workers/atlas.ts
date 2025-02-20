/*
* ConnectionStore - Maintain the WebSocket connection with CloudTAK Server
*/

import { expose, proxy } from 'comlink';
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

    db = proxy(new AtlasDatabase(this));
    conn = proxy(new AtlasConnection(this));
    profile = proxy(new AtlasProfile(this));

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

const atlas = proxy(new Atlas())

expose(atlas);

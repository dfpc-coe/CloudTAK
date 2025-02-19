/*
* ConnectionStore - Maintain the WebSocket connection with CloudTAK Server
*/

import { expose } from 'comlink';
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

    db: AtlasDatabase;
    conn: AtlasConnection;
    profile: AtlasProfile;

    constructor() {
        this.channel = new BroadcastChannel('cloudtak');

        this.token = '';

        this.db = new AtlasDatabase(this);
        this.profile = new AtlasProfile(this);
        this.conn = new AtlasConnection(this);
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

expose(atlas);

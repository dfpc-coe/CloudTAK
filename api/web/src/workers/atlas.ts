/*
* ConnectionStore - Maintain the WebSocket connection with CloudTAK Server
*/

import { expose } from 'comlink';
import AtlasProfile from './atlas-profile.ts';
import AtlasDatabase from './atlas-database.ts';
import AtlasConnection from './atlas-connection.ts';

export default class Atlas {
    token: string;

    db: AtlasDatabase;
    conn: AtlasConnection;
    profile: AtlasProfile;

    constructor(emit: Worker.postMessage) {
        this.emit = emit;

        this.token = '';

        this.db = new AtlasDatabase(this);
        this.profile = new AtlasProfile(this);
        this.conn = new AtlasConnection(this);
    }

    async init(authToken: string) {
        this.token = authToken;

        await Promise.allSettled([
            this.profile.init()
        ])
    }

    destroy() {
        purse.isDestroyed = true;

        if (purse.ws) {
            purse.ws.close();
        }
    }
}

const atlas = new Atlas();

expose({
    atlas,
    db: atlas.db,
    conn: atlas.conn,
    profile: atlas.profile
})

/*
* ConnectionStore - Maintain the WebSocket connection with CloudTAK Server
*/

import COT from '../base/cot.ts';
import * as Comlink from 'comlink';
import AtlasProfile from './atlas-profile.ts';
import AtlasDatabase from './atlas-database.ts';
import AtlasConnection from './atlas-connection.ts';
import type { Remote, TransferHandler } from 'comlink';
import type { Feature } from '../types.ts';

export class CloudTAKTransferHandler {
    atlas: Atlas | Remote<Atlas>;
    sync: BroadcastChannel | null;

    constructor(atlas: Atlas | Remote<Atlas>, sync?: BroadcastChannel) {
        this.atlas = atlas;
        this.sync = sync || null;
    }

    cot: TransferHandler<unknown, unknown> = {
        canHandle: (obj) => obj instanceof COT,
        serialize: (cot: COT) => {
            const feat = cot.as_feature();
            return [feat, []];
        },
        deserialize: (feat: Feature) => {
            return new COT(this.atlas, feat, feat.origin, {
                remote: this.sync ? this.sync : null
            });
        }
    }
}

export default class Atlas {
    channel: BroadcastChannel;

    token: string;

    db = Comlink.proxy(new AtlasDatabase(this));
    conn = Comlink.proxy(new AtlasConnection(this));
    profile = Comlink.proxy(new AtlasProfile(this));

    constructor() {
        this.channel = new BroadcastChannel('cloudtak');
        this.sync = new BroadcastChannel('sync');
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

const transfer = new CloudTAKTransferHandler(atlas);
Comlink.transferHandlers.set("cot", transfer.cot);

Comlink.expose(Comlink.proxy(atlas));

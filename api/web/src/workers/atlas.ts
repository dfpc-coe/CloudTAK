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

    cots: TransferHandler<unknown, unknown> = {
        canHandle: (obj) => {
            if (!(obj instanceof Set)) return false;
            for (const val of obj.values()) {
                if (!(val instanceof COT)) return false;
            }
            return true;
        },
        serialize: (cots: Set<COT>) => {
            const feats = [];
            for (const cot of cots.values()) {
                feats.push(this.cot.serialize(cot))
            }
            return [feats, []];
        },
        deserialize: (feats: Array<Feature>) => {
            const set = new Set<COT>;
            for (const feat of feats) {
                set.add(this.cot.deserialize(feat));
            }

            return set;
        }
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
    sync: BroadcastChannel;

    token: string;

    db = Comlink.proxy(new AtlasDatabase(this));
    conn = Comlink.proxy(new AtlasConnection(this));
    profile = Comlink.proxy(new AtlasProfile(this));

    constructor() {
        this.channel = new BroadcastChannel('cloudtak');
        this.sync = new BroadcastChannel('sync');
        this.token = '';
    }

    async postMessage(msg: string): Promise<void> {
        return this.channel.postMessage(msg);
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
Comlink.transferHandlers.set("cots", transfer.cots);

Comlink.expose(Comlink.proxy(atlas));

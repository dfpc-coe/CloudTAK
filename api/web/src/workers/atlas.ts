/*
* ConnectionStore - Maintain the WebSocket connection with CloudTAK Server
*/

import COT from '../base/cot.ts';
import { WorkerMessage } from '../base/events.ts';
import Subscription from '../base/mission.ts';
import * as Comlink from 'comlink';
import AtlasProfile from './atlas-profile.ts';
import AtlasDatabase from './atlas-database.ts';
import AtlasConnection from './atlas-connection.ts';
import type { Remote, TransferHandler } from 'comlink';
import type { Feature } from '../types.ts';
import type {
    Mission,
    MissionLog,
    MissionRole,
} from '../types.ts';

export class CloudTAKTransferHandler {
    atlas: Atlas | Remote<Atlas>;
    sync: BroadcastChannel | null;

    constructor(
        atlas: Atlas | Remote<Atlas>,
        transferHandlers: Map<string, TransferHandler<unknown, unknown>>,
        sync?: BroadcastChannel
    ) {
        this.atlas = atlas;
        this.sync = sync || null;

        transferHandlers.set("cot", this.cot);
        transferHandlers.set("cots", this.cots);
        transferHandlers.set("subscription", this.subscription);
    }

    subscription: TransferHandler<Subscription, {
        mission: Mission,
        role: MissionRole,
        token?: string,
        logs: Array<MissionLog>
    }> = {
        canHandle: (obj): obj is Subscription => {
            return obj instanceof Subscription;
        },
        serialize: (subscription: Subscription) => {
            return [{
                mission: subscription.meta,
                role: subscription.role,
                logs: subscription.logs,
            }, []]
        },
        deserialize: (ser: {
            mission: Mission,
            role: MissionRole,
            token?: string,
            logs: Array<MissionLog>
        }) => {
            const sub = new Subscription(
                this.atlas, 
                ser.mission,
                ser.role,
                ser.logs,
                {
                    token: ser.token,
                    remote: this.sync ? this.sync : null
                }
            );

            return sub;
        }
    }

    cots: TransferHandler<Set<COT>, Array<Feature>> = {
        canHandle: (obj): obj is Set<COT> => {
            if (!(obj instanceof Set)) return false;
            for (const val of obj.values()) {
                if (!(val instanceof COT)) return false;
            }
            return true;
        },
        serialize: (cots: Set<COT>) => {
            const feats = [];
            for (const cot of cots.values()) {
                feats.push(cot.as_feature());
            }
            return [feats, []];
        },
        deserialize: (feats) => {
            const set = new Set<COT>;
            for (const feat of feats) {
                set.add(new COT(this.atlas, feat, feat.origin, {
                    remote: this.sync ? this.sync : null
                }));
            }

            return set;
        }
    }

    cot: TransferHandler<COT, Feature> = {
        canHandle: (obj): obj is COT => {
            return obj instanceof COT;
        },
        serialize: (cot: COT) => {
            const feat = cot.as_feature();
            return [feat, []];
        },
        deserialize: (feat: Feature): COT => {
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

    async postMessage(msg: {
        type: WorkerMessage,
        body?: object
    }): Promise<void> {
        return this.channel.postMessage(JSON.stringify(msg));
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

new CloudTAKTransferHandler(atlas, Comlink.transferHandlers);

Comlink.expose(Comlink.proxy(atlas));

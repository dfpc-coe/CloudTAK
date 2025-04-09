/*
* ConnectionStore - Maintain the WebSocket connection with CloudTAK Server
*/

import COT from '../base/cot.ts';
import { WorkerMessageType, LocationState } from '../base/events.ts';
import type { WorkerMessage } from '../base/events.ts';
import Subscription from '../base/subscription.ts';
import * as Comlink from 'comlink';
import AtlasProfile from './atlas-profile.ts';
import type { ProfileLocation } from './atlas-profile.ts';
import AtlasTeam from './atlas-team.ts';
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
        feats: Array<Feature>,
        logs: Array<MissionLog>
    }> = {
        canHandle: (obj): obj is Subscription => {
            return obj instanceof Subscription;
        },
        serialize: (subscription: Subscription) => {
            const feats = [];
            for (const cot of subscription.cots.values()) {
                feats.push(cot.as_feature());
            }

            return [{
                mission: subscription.meta,
                role: subscription.role,
                logs: subscription.logs,
                feats: feats
            }, []]
        },
        deserialize: (ser: {
            mission: Mission,
            role: MissionRole,
            token?: string,
            feats: Array<Feature>,
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

            for (const feat of ser.feats) {
                const cot = new COT(this.atlas, feat, feat.origin, {
                    remote: this.sync ? this.sync : null
                });

                sub.cots.set(cot.id, cot);
            }

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

    async postMessage(msg: WorkerMessage): Promise<void> {
        return this.channel.postMessage(msg);
    }

    async init(authToken: string) {
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

new CloudTAKTransferHandler(atlas, Comlink.transferHandlers);

Comlink.expose(Comlink.proxy(atlas));

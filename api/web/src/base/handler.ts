/*
* ConnectionStore - Maintain the WebSocket connection with CloudTAK Server
*/

import COT from '../base/cot.ts';
import Subscription from '../base/subscription.ts';
import type { DatabaseType } from '../base/database.ts';
import type Atlas from '../workers/atlas.ts';
import type { Remote, TransferHandler } from 'comlink'
import type { Feature } from '../types.ts';
import type {
    Mission,
    MissionRole,
} from '../types.ts';

export class CloudTAKTransferHandler {
    db: DatabaseType;
    atlas: Atlas | Remote<Atlas>;
    remote: boolean;

    constructor(
        atlas: Atlas | Remote<Atlas>,
        db: DatabaseType,
        transferHandlers: Map<string, TransferHandler<unknown, unknown>>,
        remote: boolean
    ) {
        this.db = db;
        this.atlas = atlas;
        this.remote = remote;

        transferHandlers.set("cot", this.cot);
        transferHandlers.set("cots", this.cots);
        transferHandlers.set("subscription", this.subscription);
    }

    subscription: TransferHandler<Subscription, {
        mission: Mission,
        role: MissionRole,
        token?: string,
        feats: Array<Feature>,
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
                token: subscription.token,
                mission: subscription.meta,
                role: subscription.role,
                feats: feats
            }, []]
        },
        deserialize: (ser: {
            mission: Mission,
            role: MissionRole,
            token?: string,
            feats: Array<Feature>,
        }) => {
            const sub = new Subscription(
                this.atlas,
                this.db,
                ser.mission,
                ser.role,
                {
                    token: ser.token,
                    remote: this.remote
                }
            );

            for (const feat of ser.feats) {
                const cot = new COT(this.atlas, feat, feat.origin, {
                    remote: this.remote
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
                    remote: this.remote
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
                remote: true
            });
        }
    }
}

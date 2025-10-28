/*
* ConnectionStore - Maintain the WebSocket connection with CloudTAK Server
*/

import COT from '../base/cot.ts';
import type Atlas from '../workers/atlas.ts';
import type { Remote, TransferHandler } from 'comlink'
import type { Feature } from '../types.ts';

export class CloudTAKTransferHandler {
    atlas: Atlas | Remote<Atlas>;
    remote: boolean;

    constructor(
        atlas: Atlas | Remote<Atlas>,
        transferHandlers: Map<string, TransferHandler<unknown, unknown>>,
        remote: boolean
    ) {
        this.atlas = atlas;
        this.remote = remote;

        transferHandlers.set("cot", this.cot);
        transferHandlers.set("cots", this.cots);
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

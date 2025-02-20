import COT from './cot.ts';
import Atlas from '../workers/atlas.ts'
import type { Remote, TransferHandler } from 'comlink';

export enum WorkerMessage {
    Notification = 'cloudtak:notification',
    Map_FlyTo = 'cloudtak:map:flyto',
}

export class CloudTAKTransferHandler {
    atlas: Atlas | Remote<Atlas>

    constructor(atlas: Atlas | Remote<Atlas>) {
        this.atlas = atlas;
    }

    cot: TransferHandler<unknown, unknown> = {
        canHandle: (obj) => obj instanceof COT,
        serialize: (obj) => {
            const feat = obj.as_feature();
            return [feat, []];
        },
        deserialize: (feat) => {
            return new COT(this.atlas, feat, feat.origin, {
                remote: true
            });
        }
    }
}

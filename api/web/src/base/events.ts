import COT from './cot.ts';
import type { Remote } from 'comlink';

export enum WorkerMessage {
    Notification = 'cloudtak:notification',
    Map_FlyTo = 'cloudtak:map:flyto',
}

export class TransferHandler {
    atlas: Atlas | Remote<Atlas>

    constructor(atlas: Atlas | Remote<Atlas>) {
        this.atlas = atlas;
    }

    cot = {
        canHandle: (obj) => obj instanceof COT,
        serialize: (obj) => {
            const feat = obj.as_feature();
            return [feat, []];
        },
        deserialize: (feat) => {
            return new COT(this.atlas, feat, feat.origin);
        }
    }
}

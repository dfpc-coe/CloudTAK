import type { Message, LocalMessage, Transform, ConvertResponse } from '../types.ts';

export default class MBTiles implements Transform {
    static register() {
        return {
            inputs: ['.mbtiles']
        };
    }

    msg: Message;
    local: LocalMessage;

    constructor(
        msg: Message,
        local: LocalMessage
    ) {
        this.msg = msg;
        this.local = local;
    }

    async convert(): Promise<ConvertResponse> {
        return {
            asset: this.local.raw
        };
    }
}

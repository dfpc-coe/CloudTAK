import path from 'node:path';
import type { Message, LocalMessage, Transform, ConvertResponse } from '../types.ts';

export default class GeoJSON implements Transform {
    static register() {
        return {
            inputs: ['.geojsonld']
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
        console.error('ok - converted to GeoJSON');
        
        return {
            asset: path.resolve(this.local.tmpdir, this.local.name)
        }
    }
}

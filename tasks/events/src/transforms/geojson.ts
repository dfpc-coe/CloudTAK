import path from 'node:path';
import type { Message, LocalMessage } from '../types.ts';

export default class GeoJSON {
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

    async convert() {
        console.error('ok - converted to GeoJSON');
        return path.resolve(this.local.tmpdir, this.local.name);
    }
}

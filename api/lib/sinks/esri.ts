import SinkInterface from '../sink.js';
// @ts-ignore
import ConnectionSink from '../types/connection-sink.js';
import Err from '@openaddresses/batch-error';

export default class ESRI extends SinkInterface {
    static type = 'ArcGIS';

    parsed: {
        base: string;
        type: string;
    }

    constructor(sink: ConnectionSink) {
        super(sink);

        if (this.sink.type !== 'ArcGIS') throw new Err(400, null, 'Can only process ArcGIS sinks');

        ESRI.parseurl(sink.body.url);
    }

    static parseurl(urlstr: string): boolean {
        let url: URL;
        try {
            url = new URL(urlstr)
        } catch (err) {
            throw new Err(400, null, `Invalid ESRI URL: ${url}`);
        }

        return true;
    }
}

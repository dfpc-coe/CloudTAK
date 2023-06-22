import SinkInterface from '../sink.js';
import ConnectionSink from './types/connection-sink.js';
import Err from '@openaddresses/batch-error';

export default class ESRI extends SinkInterface {
    parsed: {
        base: string;
        type: string;
    }

    constructor(sink: ConnectionSink) {
        super(sink);

        if (this.sink.type !== 'ArcGIS') throw new Err(400, null, 'Can only process ArcGIS sinks');

        ESRI.parseurl(this.data.url);
    }

    static parseurl() {
        new URL(this.sink.body.url)
    }
}

// @ts-ignore
import ConnectionSink from './types/connection-sink.js';
import Err from '@openaddresses/batch-error';

export default class SinkInterface {
    sink: ConnectionSink;

    constructor(sink: ConnectionSink) {
        this.sink = sink
    }

    static sink_name(): string {
        return 'generic';
    }

    /**
     * Called when the server starts to ensure a Sink is properly prepared to accept data
     */
    async is_prepared(): Promise<boolean> {
        return true;
    }
}

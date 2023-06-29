// @ts-ignore
import ConnectionSink from './types/connection-sink.js';
import Err from '@openaddresses/batch-error';

export default class SinkInterface {
    static sink_name(): string {
        return 'generic';
    }

    static async secrets(sink: ConnectionSink): Promise<any> {
        return {};
    }
}

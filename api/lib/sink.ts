// @ts-ignore
import ConnectionSink from './types/connection-sink.ts';
import Config from './config.ts';

export default class SinkInterface {
    static sink_name(): string {
        return 'generic';
    }

    static async secrets(config: Config, sink: ConnectionSink): Promise<any> {
        return {
            SinkId: sink.id,
            StackName: config.StackName
        };
    }
}

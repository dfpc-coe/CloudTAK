import { ConnectionSink } from './schema.ts';
import { InferSelectModel } from 'drizzle-orm';
import Config from './config.ts';

export default class SinkInterface {
    static sink_name(): string {
        return 'generic';
    }

    static async secrets(config: Config, sink: InferSelectModel<typeof ConnectionSink>): Promise<object> {
        return {
            SinkId: sink.id,
            StackName: config.StackName
        };
    }
}

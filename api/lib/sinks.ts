//@ts-ignore
import Connection from './types/connection.js';
import Config from './config.js';
import { CoT } from '@tak-ps/node-tak';
//@ts-ignore
import ConnectionSink from './types/connection-sink.js';
import ESRISink from './sinks/esri.js';
import HookQueue from './aws/hooks.js';
import Cacher from './cacher.js';

export default class Sinks extends Map<string, any> {
    config: Config;
    queue: HookQueue;

    constructor(config: Config) {
        super();
        this.config = config;
        this.queue = new HookQueue();

        // Include Supported Sink Types Here
        this.set('ArcGIS', ESRISink);
    }

    async cot(conn: Connection, cot: CoT): Promise<boolean> {
        const sinks = await this.config.cacher.get(Cacher.Miss({}, `connection-${conn.id}-sinks`), async () => {
            return await ConnectionSink.list(this.config.pool, { connection: conn.id, enabled: true })
        });

        for (const sink of sinks.sinks) {
            const handler = this.get(sink.type);

            const secrets = await handler.secrets(this.config, sink);
            const feat = cot.to_geojson();

            const options = {
                logging: sink.logging
            };

            this.queue.submit(conn.id, JSON.stringify({
                id: sink.id,
                type: sink.type,
                body: sink.body,
                feat, secrets, options
            }));
        }

        return true;
    }
}

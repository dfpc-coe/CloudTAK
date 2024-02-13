import Config from './config.js';
import { CoT } from '@tak-ps/node-tak';
import ESRISink from './sinks/esri.js';
import SinkInterface from './sink.js';
import HookQueue from './aws/hooks.js';
import Cacher from './cacher.js';
import { Connection, ConnectionSink } from './schema.js';
import { type InferSelectModel } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import Modeler from '@openaddresses/batch-generic';

export default class Sinks extends Map<string, typeof SinkInterface> {
    config: Config;
    queue: HookQueue;

    constructor(config: Config) {
        super();
        this.config = config;
        this.queue = new HookQueue();

        // Include Supported Sink Types Here
        this.set('ArcGIS', ESRISink);
    }

    async cot(conn: InferSelectModel<typeof Connection>, cot: CoT): Promise<boolean> {
        const sinks = await this.config.cacher.get(Cacher.Miss({}, `connection-${conn.id}-sinks`), async () => {
            const ConnectionSinkModel = new Modeler(this.config.pg, ConnectionSink);

            return await ConnectionSinkModel.list({
                where: sql`
                    connection = ${conn.id}
                    AND enabled = True
                `
            });
        });

        for (const sink of sinks.items) {
            const handler = this.get(sink.type);

            if (!handler) continue;

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

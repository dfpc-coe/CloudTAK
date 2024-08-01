import Config from './config.js';
import { CoT } from '@tak-ps/node-tak';
import ESRISink from './sinks/esri.js';
import type SinkInterface from './sink.js';
import HookQueue from './aws/hooks.js';
import Cacher from './cacher.js';
import { ConnectionSink } from './schema.js';
import { sql } from 'drizzle-orm';
import Modeler from '@openaddresses/batch-generic';
import ConnectionConfig from './connection-config.js';
import SQS from '@aws-sdk/client-sqs';

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

    async cots(conn: ConnectionConfig, cots: CoT[]): Promise<boolean> {
        if (cots.length === 0) return true;

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

            const options = {
                logging: sink.logging
            };

            do {
                try {
                    await this.queue.submit(
                        cots.splice(0, 10).map((cot) => {
                            const feat = cot.to_geojson();

                            return {
                                Id: (Math.random() + 1).toString(36).substring(7),
                                MessageGroupId: String(conn.id),
                                MessageBody: JSON.stringify({
                                    id: sink.id,
                                    type: sink.type,
                                    body: sink.body,
                                    feat, secrets, options
                                })
                            } as SQS.SendMessageBatchRequestEntry;
                        })
                    );
                } catch (err) {
                    console.error(err);
                }
            } while (cots.length);
        }

        return true;
    }
}

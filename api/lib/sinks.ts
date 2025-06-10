import Config from './config.js';
import { CoT } from '@tak-ps/node-tak';
import Filter from './filter.js';
import Queue from './aws/queue.js';
import { sql } from 'drizzle-orm';
import ConnectionConfig from './connection-config.js';
import SQS from '@aws-sdk/client-sqs';

export default class Sinks {
    config: Config;
    queue: Queue;

    constructor(config: Config) {
        this.config = config;
        this.queue = new Queue();
    }

    async cots(conn: ConnectionConfig, cots: CoT[]): Promise<boolean> {
        if (cots.length === 0) return true;

        for await (const layer of this.config.models.Layer.augmented_iter({
            where: sql`
                layers.connection = ${conn.id}
                AND layers.enabled IS True
                AND layers_outgoing.layer IS NOT NULL
            `
        })) {
            if (!layer.outgoing) continue;
            const arnPrefix = (await this.config.fetchArnPrefix()).split(':');
            const queue = `https://sqs.${arnPrefix[3]}.amazonaws.com/${arnPrefix[4]}/${this.config.StackName}-layer-${layer.id}-outgoing.fifo`;

            const filtered: CoT[] = [];
/*
            for (const cot of cots) {
                if (await Filter.test(layer.outgoing.filters, cot)) {
                    continue;
                }

                filtered.push(cot);
            }
*/

            for (let i = 0; i < filtered.length; i+= 10) {
                try {
                    await this.queue.submit(
                        filtered.slice(i, i + 10).map((cot) => {
                            return {
                                Id: (Math.random() + 1).toString(36).substring(7),
                                MessageGroupId: `${String(layer.id)}-${cot.uid()}`,
                                MessageBody: JSON.stringify({
                                    xml: cot.to_xml(),
                                    geojson: cot.to_geojson()
                                })
                            } as SQS.SendMessageBatchRequestEntry;
                        }), queue);
                } catch (err) {
                    console.error(`Queue: `, queue, ':', err);
                }
            }
        }

        return true;
    }
}

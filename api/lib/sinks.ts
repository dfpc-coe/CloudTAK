import Config from './config.js';
import { randomUUID } from 'node:crypto';
import { CoT } from '@tak-ps/node-tak';
import QueueClient from './aws/queue.js';
import { sql } from 'drizzle-orm';
import ConnectionConfig from './connection-config.js';
import SQS from '@aws-sdk/client-sqs';

const MAX_QUEUE_LENGTH = 10000;

export class QueueTasker {
    layer: number;
    queue: Array<CoT>;
    queueARN: string;
    processing: boolean;

    constructor(
        layer: number,
        queueARN: string,
        queue: Array<CoT>
    ) {
        this.layer = layer;
        this.queue = queue;
        this.queueARN = queueARN;
        this.processing = false;
    }

    ping(): void {
        if (this.processing) {
            return;
        } else {
            this.process();
        }
    }

    async process() {
        this.processing = true;

        for (let i = 0; i < this.queue.length; i+= 10) {
            try {
                await this.queue.submit(
                    this.queue.slice(i, i + 10).map((cot) => {
                        return {
                            Id: randomUUID(),
                            MessageGroupId: `${String(this.layer)}-${cot.uid()}`,
                            MessageBody: JSON.stringify({
                                xml: cot.to_xml(),
                                geojson: cot.to_geojson()
                            })
                        } as SQS.SendMessageBatchRequestEntry;
                    }),
                    this.queueARN
                );
            } catch (err) {
                console.error(`Queue: `, queue, ':', err);
            }

            if (this.queue.length > MAX_QUEUE_LENGTH) {
                console.error(`Queue Layer ${layer} length Exceeded MAX QUEUE: ${MAX_QUEUE_LENGTH}`);
                this.queue.split(0, this.queue.length);
            }
        }

        this.processing = false;
    }
}

export default class SinkQueueControl {
    config: Config;
    queue: Map<number, Map<number, CoT[]>>;
    taskers: Map<number, QueueTasker>;
    client: QueueClient;

    constructor(config: Config) {
        this.config = config;
        this.client = new QueueClient();
    }

    async cots(
        conn: ConnectionConfig,
        cots: CoT[]
    ): Promise<boolean> {
        // Connections with String IDs are user connections
        if (typeof conn.id !== 'number') return false;
        if (cots.length === 0) return true;

        let connectionQueue = this.queue.get(conn.id);
        if (!connectionQueue) {
            connectionQueue = new Map<number, CoT[]>;
            this.queue.set(conn.id, connectionQueue);
        }

        for await (const layer of this.config.models.Layer.augmented_iter({
            where: sql`
                layers.connection = ${conn.id}
                AND layers.enabled IS True
                AND layers_outgoing.layer IS NOT NULL
            `
        })) {
            let layerQueue = connectionQueue.get(layer.id);

            if (!layerQueue) {
                layerQueue = [];
                connectionQueue.set(conn.id, layerQueue);
            }

            layerQueue.unshift(...cots);

            const tasker = taskers.get(layer.id);

            if (!tasker) {
                const arnPrefix = (await this.config.fetchArnPrefix()).split(':');
                const newTasker = new QueueTasker(
                    layer.id,
                    `https://sqs.${arnPrefix[3]}.amazonaws.com/${arnPrefix[4]}/${this.config.StackName}-layer-${layer.id}-outgoing.fifo`,
                    layerQueue
                )

                this.taskers.set(layer.id, newTasker);
                newTasker.ping();
            } else {
                tasker.ping();
            }
        }

        return true;
    }
}

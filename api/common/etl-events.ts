import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import type { Static } from '@sinclair/typebox';
import type SQS from '@aws-sdk/client-sqs';
import type CoT from '@tak-ps/node-cot';
import { CoTParser } from '@tak-ps/node-cot';
import { TAKAPI, APIAuthCertificate } from '@tak-ps/node-tak';
import { OutgoingMessageType, OutgoingAction, StaticCapabilities } from '@tak-ps/etl';
import type Config from './config.js';
import type ConnectionConfig from './connection-config.js';
import type { CoreEventResponse } from './types.js';
import Filter from './filter.js';
import Queue from './aws/queue.js';

export { OutgoingAction as ETLEventAction };

type Message = {
    group: string;
    body: Record<string, unknown>;
};

/**
 * Delivery of Outgoing ETL Events - the SQS messages a Layer's Outgoing Task
 * is invoked with, in the `OutgoingMessage` envelope of @tak-ps/etl
 *
 * Feature events are the streaming CoTs of a Connection, delivered to every
 * enabled Outgoing Layer of that Connection. Event events are CoreEvent
 * lifecycle changes, delivered to Outgoing Layers subscribed to
 * `event:<action>` whose Connection shares a Channel with the Event
 */
export default class ETLEvents {
    config: Config;
    queue: Queue;

    constructor(config: Config) {
        this.config = config;
        this.queue = new Queue();
    }

    async queueUrl(layer: number): Promise<string> {
        const arnPrefix = (await this.config.fetchArnPrefix()).split(':');
        return `https://sqs.${arnPrefix[3]}.amazonaws.com/${arnPrefix[4]}/${this.config.StackName}-layer-${layer}-outgoing.fifo`;
    }

    async features(conn: ConnectionConfig, cots: CoT[]): Promise<boolean> {
        if (this.config.noetlevents || cots.length === 0) return true;

        for await (const layer of this.config.models.Layer.augmented_iter({
            where: sql`
                layers.connection = ${conn.id}
                AND layers.enabled IS True
                AND layers_outgoing.layer IS NOT NULL
            `,
        })) {
            if (!layer.outgoing) continue;

            const messages: Message[] = [];
            for (const cot of cots) {
                if (await Filter.test(layer.outgoing.filters, cot)) continue;

                messages.push({
                    group: `${layer.id}-${cot.uid()}`,
                    body: {
                        type: OutgoingMessageType.Feature,
                        xml: await CoTParser.to_xml(cot),
                        geojson: await CoTParser.to_geojson(cot),
                    },
                });
            }

            await this.submit(layer.id, messages);
        }

        return true;
    }

    async event(action: OutgoingAction, event: Static<typeof CoreEventResponse>): Promise<void> {
        if (this.config.noetlevents) return;

        const resource = `${OutgoingMessageType.Event}:${action}`;
        const channels = new Set(event.channels.map(Number));
        if (!channels.size) return;

        const shared = new Map<number, number[]>();

        for await (const layer of this.config.models.Layer.augmented_iter({
            where: sql`
                layers.enabled IS True
                AND layers.connection IS NOT NULL
                AND layers_outgoing.layer IS NOT NULL
                AND layers_outgoing.subscriptions && ARRAY[${resource}, ${`${OutgoingMessageType.Event}:*`}]::TEXT[]
            `,
        })) {
            if (!layer.outgoing || layer.connection === null) continue;
            if (!StaticCapabilities.isSubscribedOutgoingType(layer.outgoing.subscriptions, resource)) continue;

            let overlap = shared.get(layer.connection);
            if (!overlap) {
                let active = new Set<number>();
                try {
                    active = await this.connectionChannels(layer.connection);
                } catch (err) {
                    console.error(`ETLEvents: failed to resolve Channels of Connection ${layer.connection}:`, err);
                }

                overlap = [...channels].filter(channel => active.has(channel)).sort((a, b) => a - b);
                shared.set(layer.connection, overlap);
            }

            if (!overlap.length) continue;

            await this.submit(layer.id, [{
                group: `${layer.id}-${event.id}`,
                body: {
                    type: OutgoingMessageType.Event,
                    action,
                    channels: overlap,
                    data: event,
                },
            }]);
        }
    }

    /**
     * Active Channel bitpos set of a Connection, as seen by the Connection's
     * own certificate
     */
    async connectionChannels(connection: number): Promise<Set<number>> {
        const conn = await this.config.models.Connection.from(connection);

        const api = await TAKAPI.init(
            new URL(String(this.config.server.api)),
            new APIAuthCertificate(conn.auth.cert, conn.auth.key),
        );

        return new Set(
            (await api.Group.list({ useCache: true })).data
                .filter(group => group.active)
                .map(group => group.bitpos),
        );
    }

    async submit(layer: number, messages: Message[]): Promise<void> {
        if (!messages.length) return;

        const queue = await this.queueUrl(layer);

        for (let i = 0; i < messages.length; i += 10) {
            const entries: SQS.SendMessageBatchRequestEntry[] = messages.slice(i, i + 10).map(message => ({
                Id: randomUUID(),
                MessageGroupId: message.group.slice(0, 128),
                MessageBody: JSON.stringify(message.body),
            }));

            try {
                await this.queue.submit(entries, queue);
            } catch (err) {
                console.error(`ETLEvents: `, queue, ':', err);
            }
        }
    }
}

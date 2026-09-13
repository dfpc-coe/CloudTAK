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
import type {
    CoreEventResponse,
    CoreEventBoardResponse,
    CoreEventBoardColumnResponse,
    CoreEventBoardEventResponse,
} from './types.js';
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
 * enabled Outgoing Layer of that Connection. Every other type is a lifecycle
 * change of a Channel scoped resource, delivered to Outgoing Layers subscribed
 * to `<type>:<action>` whose Connection has one of the resource's Channels
 * active
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

    /** `event:<action>` - a CoreEvent, scoped to the Channels it is shared with */
    async event(action: OutgoingAction, event: Static<typeof CoreEventResponse>): Promise<void> {
        await this.deliver(OutgoingMessageType.Event, action, event.id, event.channels.map(Number), event);
    }

    /** `board:<action>` - a CoreEvent Board, scoped to its Channel */
    async board(action: OutgoingAction, board: Static<typeof CoreEventBoardResponse>): Promise<void> {
        await this.deliver(OutgoingMessageType.Board, action, board.id, [board.channel], board);
    }

    /** `board:column:<action>` - a Column, scoped to the Channel of the Board it belongs to */
    async boardColumn(action: OutgoingAction, channel: number, column: Static<typeof CoreEventBoardColumnResponse>): Promise<void> {
        await this.deliver(OutgoingMessageType.BoardColumn, action, column.id, [channel], column);
    }

    /** `board:event:<action>` - a CoreEvent placed on a Board, scoped to the Channel of that Board */
    async boardEvent(action: OutgoingAction, channel: number, placement: Static<typeof CoreEventBoardEventResponse>): Promise<void> {
        await this.deliver(OutgoingMessageType.BoardEvent, action, placement.id, [channel], placement);
    }

    /**
     * Deliver a `<type>:<action>` message to every enabled Outgoing Layer
     * subscribed to it (or to `<type>:*`) whose Connection has one of the
     * given Channels active
     */
    async deliver(
        type: OutgoingMessageType,
        action: OutgoingAction,
        id: string,
        shared: number[],
        data: Record<string, unknown>,
    ): Promise<void> {
        if (this.config.noetlevents) return;

        const resource = `${type}:${action}`;
        const channels = new Set(shared);
        if (!channels.size) return;

        const overlaps = new Map<number, number[]>();

        for await (const layer of this.config.models.Layer.augmented_iter({
            where: sql`
                layers.enabled IS True
                AND layers.connection IS NOT NULL
                AND layers_outgoing.layer IS NOT NULL
                AND layers_outgoing.subscriptions && ARRAY[${resource}, ${`${type}:*`}]::TEXT[]
            `,
        })) {
            if (!layer.outgoing || layer.connection === null) continue;
            if (!StaticCapabilities.isSubscribedOutgoingType(layer.outgoing.subscriptions, resource)) continue;

            let overlap = overlaps.get(layer.connection);
            if (!overlap) {
                let active = new Set<number>();
                try {
                    active = await this.connectionChannels(layer.connection);
                } catch (err) {
                    console.error(`ETLEvents: failed to resolve Channels of Connection ${layer.connection}:`, err);
                }

                overlap = [...channels].filter(channel => active.has(channel)).sort((a, b) => a - b);
                overlaps.set(layer.connection, overlap);
            }

            if (!overlap.length) continue;

            await this.submit(layer.id, [{
                group: `${layer.id}-${id}`,
                body: {
                    type,
                    action,
                    channels: overlap,
                    data,
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

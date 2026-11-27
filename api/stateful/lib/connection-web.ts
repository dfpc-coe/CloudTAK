import { Static } from '@sinclair/typebox';
import { randomUUID } from 'node:crypto';
import { MissionChat, CoTParser } from '@tak-ps/node-cot';
import type { Feature } from '@tak-ps/node-cot';
import WebSocket from 'ws';
import { ConnectionClient } from './connection-pool.js';
import { ChatMessageStatus, WebSocket_Event } from '../../common/enums.js';
import { ProfileConnConfig } from '../../common/connection-config.js';
import { profileCallsign } from '../../common/control/takserver.js';
import LegacyChatControl from '../../common/chat/legacy.js';
import { sourceOf, toSecondary } from './location-arbiter.js';
import { rawDataToString } from '../../common/stringify.js';

export class ConnectionWebSocket {
    ws: WebSocket;
    format: string;
    events: WebSocket_Event[];
    session?: string;
    client?: ConnectionClient;

    constructor(
        ws: WebSocket,
        format = 'raw',
        events: WebSocket_Event[] = [WebSocket_Event.MAP],
        client?: ConnectionClient,
        session?: string,
    ) {
        this.ws = ws;
        this.format = format;
        this.events = events.length ? [...new Set(events)] : [WebSocket_Event.MAP];
        this.session = session;

        if (client) {
            this.client = client;
            this.ws.on('message', async (data) => {
                try {
                    const msg = JSON.parse(rawDataToString(data));

                    if (msg.type === 'ping') {
                        this.ws.send(JSON.stringify({ type: 'pong' }));
                    } else if (msg.type === 'chat' && !msg.data.mission) {
                        await this.legacyChat(client, msg.data);
                    } else if (msg.type === 'chat') {
                        const profile = client.config instanceof ProfileConnConfig ? client.config : undefined;

                        // The sender is who the connection belongs to, never who the browser claims to be
                        const from: { uid: string; callsign: string } = profile
                            ? { uid: profile.uid(), callsign: await profileCallsign(profile.config, profile.id) }
                            : { uid: String(msg.data.from.uid), callsign: String(msg.data.from.callsign) };

                        const serverUrl = new URL(client.config.config.server.url);
                        const apiUrl = new URL(String(client.config.config.server.api));
                        const protocol = serverUrl.protocol.replace(':', '');
                        const missionId = `${apiUrl.hostname}-${apiUrl.port}-${protocol}-${msg.data.chatroom}`;

                        const chat = new MissionChat({
                            from: {
                                uid: from.uid,
                            },
                            mission: {
                                name: msg.data.chatroom,
                                id: missionId,
                                guid: msg.data.guid,
                            },
                            senderCallsign: from.callsign,
                            message: msg.data.message,
                            messageId: msg.data.messageId,
                            parent: msg.data.parent,
                            groupOwner: msg.data.groupOwner,
                        });

                        if (msg.data.location && msg.data.location[0] !== 0 && msg.data.location[1] !== 0) {
                            chat.position(msg.data.location);
                        }

                        const feat = await CoTParser.to_geojson(chat);
                        const messageId = feat.properties.chat ? (feat.properties.chat.messageId || randomUUID()) : randomUUID();

                        let status = ChatMessageStatus.FAILED;

                        if (client.ready) {
                            try {
                                await client.tak.write([chat], { stripFlow: true });
                                status = ChatMessageStatus.SENT;
                            } catch (err) {
                                console.error(`Error: Failed to write Chat ${messageId}:`, err);
                            }
                        }

                        // Tell all of the user's clients whether the message reached the TAK Server
                        for (const wsClient of (client.config.config.wsClients.get(String(client.config.id)) || [])) {
                            if (!wsClient.events.includes(WebSocket_Event.MAP)) continue;

                            if (wsClient.format === 'geojson') {
                                wsClient.ws.send(JSON.stringify({
                                    type: 'chat:receipt',
                                    connection: client.config.id,
                                    data: {
                                        messageId,
                                        status,
                                        chatroom: String(msg.data.chatroom),
                                        created: new Date().toISOString(),
                                    },
                                }));
                            }
                        }
                    } else if (msg.type === 'broadcast:claim') {
                        if (client.config instanceof ProfileConnConfig && this.session) {
                            client.config.config.locationArbiter.claim(String(client.config.id), this.session);
                        }
                    } else {
                        const feat = msg.data as Static<typeof Feature.Feature>;

                        const cot = await CoTParser.from_geojson(feat);

                        let relay = false;
                        const loose = feat as { id?: unknown; properties?: { id?: unknown; ce?: unknown }; geometry?: { coordinates?: unknown } };
                        if (client.config instanceof ProfileConnConfig && (loose.id ?? loose.properties?.id) === client.config.uid()) {
                            const arbiter = client.config.config.locationArbiter;
                            const { source, accuracy } = sourceOf(loose.geometry?.coordinates, loose.properties?.ce);
                            const decision = arbiter.decide(String(client.config.id), {
                                session: this.session,
                                source,
                                accuracy,
                                channel: 'ws',
                            });
                            if (decision.changed) client.config.config.conns.sendStatus(client.config.id);
                            if (decision.secondary) toSecondary(cot, decision.secondary);
                            else if (!decision.accept) return;
                            relay = source !== 'none';
                        }

                        void client.tak.write([cot], { stripFlow: true });

                        if (relay) {
                            // TAK Server does not echo a CoT to the connection that sent it
                            client.config.config.conns.cots(client.config, [cot], { excludeSession: this.session }).catch((err) => {
                                console.error('Error: Failed to relay self location:', err);
                            });
                        }
                    }
                } catch (err) {
                    console.warn('Warning: Validation Error on WebSocket CoT message:', rawDataToString(data), err);
                    this.ws.send(JSON.stringify({
                        type: 'Error',
                        properties: {
                            message: err instanceof Error ? err.message : String(err),
                        },
                    }));
                }
            });
        }
    }

    /** CloudTAK <= 14.0 sends to a Chatroom over the WebSocket, newer clients use the API */
    private async legacyChat(client: ConnectionClient, data: Record<string, unknown>): Promise<void> {
        if (!(client.config instanceof ProfileConnConfig)) {
            throw new Error('Only Mission Chat can be sent over the WebSocket of a Connection');
        }

        const text = (value: unknown): string | undefined => typeof value === 'string' && value ? value : undefined;

        const to = (data.to ?? {}) as Record<string, unknown>;
        const uid = text(to.uid);
        const chatroom = text(data.chatroom);
        const messageId = text(data.messageId);

        try {
            if (!chatroom) throw new Error('Chatroom is required');

            await new LegacyChatControl(client.config.config).send(String(client.config.id), {
                chatroom,
                to: uid ? { uid, callsign: text(to.callsign) ?? uid } : undefined,
                message: text(data.message) ?? '',
                messageId,
                location: Array.isArray(data.location) ? data.location.map(Number) : undefined,
            });
        } catch (err) {
            console.error(`Error: Failed to send Chat ${messageId}:`, err);

            this.ws.send(JSON.stringify({
                type: 'chat:receipt',
                connection: client.config.id,
                data: {
                    messageId,
                    status: ChatMessageStatus.FAILED,
                    chatroom,
                },
            }));
        }
    }

    destroy() {
        this.ws.close();
        delete this.client;
    }
}

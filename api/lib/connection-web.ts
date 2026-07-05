import { Static } from '@sinclair/typebox';
import { randomUUID } from 'node:crypto';
import { DirectChat, MissionChat, CoTParser } from '@tak-ps/node-cot';
import type { Feature } from '@tak-ps/node-cot';
import WebSocket from 'ws';
import { ConnectionClient } from './connection-pool.js';
import { ProfileChatStatus } from './enums.js';

export class ConnectionWebSocket {
    ws: WebSocket;
    format: string;
    session?: string;
    client?: ConnectionClient;

    constructor(ws: WebSocket, format = 'raw', client?: ConnectionClient, session?: string) {
        this.ws = ws;
        this.format = format;
        this.session = session;

        if (client) {
            this.client = client;
            this.ws.on('message', async (data) => {
                try {
                    const msg = JSON.parse(String(data));

                    if (msg.type === 'chat') {
                        let chat: DirectChat | MissionChat;

                        if (msg.data.mission) {
                            const serverUrl = new URL(client.config.config.server.url);
                            const apiUrl = new URL(String(client.config.config.server.api));
                            const protocol = serverUrl.protocol.replace(':', '');
                            const hostname = apiUrl.hostname;
                            const port = apiUrl.port;
                            const missionId = `${hostname}-${port}-${protocol}-${msg.data.chatroom}`;

                            chat = new MissionChat({
                                from: {
                                    uid: msg.data.from.uid,
                                },
                                mission: {
                                    name: msg.data.chatroom,
                                    id: missionId,
                                    guid: msg.data.guid,
                                },
                                senderCallsign: msg.data.from.callsign,
                                message: msg.data.message,
                                messageId: msg.data.messageId,
                                parent: msg.data.parent,
                                groupOwner: msg.data.groupOwner,
                            });
                        } else {
                            chat = new DirectChat(msg.data);
                        }

                        if (msg.data.location && msg.data.location[0] !== 0 && msg.data.location[1] !== 0) {
                            chat.position(msg.data.location);
                        }

                        client.tak.write([chat], { stripFlow: true });

                        const feat = await CoTParser.to_geojson(chat);
                        const messageId = feat.properties.chat ? (feat.properties.chat.messageId || randomUUID()) : randomUUID();

                        const stored = await client.config.config.models.ProfileChat.generate({
                            username: String(client.config.id),
                            chatroom: msg.data.chatroom,
                            sender_callsign: msg.data.from.callsign,
                            sender_uid: msg.data.from.uid,
                            message_id: messageId,
                            message: msg.data.message,
                            status: ProfileChatStatus.SENT,
                        });

                        // Confirm to all of the user's clients that the message reached the server
                        // Includes the server-assigned created (normalized to ISO 8601) so clients can
                        // replace their optimistic local-clock timestamp with the authoritative one
                        for (const wsClient of (client.config.config.wsClients.get(String(client.config.id)) || [])) {
                            if (wsClient.format === 'geojson') {
                                wsClient.ws.send(JSON.stringify({
                                    type: 'chat:receipt',
                                    connection: client.config.id,
                                    data: {
                                        messageId,
                                        status: ProfileChatStatus.SENT,
                                        chatroom: msg.data.chatroom,
                                        created: new Date(stored.created).toISOString(),
                                    },
                                }));
                            }
                        }
                    } else {
                        const feat = msg.data as Static<typeof Feature.Feature>;

                        const cot = await CoTParser.from_geojson(feat);

                        client.tak.write([cot], { stripFlow: true });
                    }
                } catch (err) {
                    console.warn('Warning: Validation Error on WebSocket CoT message:', String(data), err);
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

    destroy() {
        this.ws.close();
        delete this.client;
    }
}

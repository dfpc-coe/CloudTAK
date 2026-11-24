import { Static } from '@sinclair/typebox';
import { randomUUID } from 'node:crypto';
import { DirectChat, MissionChat, CoTParser } from '@tak-ps/node-cot';
import type { Feature } from '@tak-ps/node-cot';
import WebSocket from 'ws';
import { ConnectionClient } from './connection-pool.js';
import { ProfileChatStatus, WebSocket_Event } from '../../common/enums.js';
import { ProfileConnConfig } from '../../common/connection-config.js';
import { profileCallsign } from '../../common/control/takserver.js';
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
                    } else if (msg.type === 'chat') {
                        let chat: DirectChat | MissionChat;

                        const profile = client.config instanceof ProfileConnConfig ? client.config : undefined;

                        // The sender is who the connection belongs to, never who the browser claims to be
                        const from: { uid: string; callsign: string } = profile
                            ? { uid: profile.uid(), callsign: await profileCallsign(profile.config, profile.id) }
                            : { uid: String(msg.data.from.uid), callsign: String(msg.data.from.callsign) };

                        if (msg.data.mission) {
                            const serverUrl = new URL(client.config.config.server.url);
                            const apiUrl = new URL(String(client.config.config.server.api));
                            const protocol = serverUrl.protocol.replace(':', '');
                            const hostname = apiUrl.hostname;
                            const port = apiUrl.port;
                            const missionId = `${hostname}-${port}-${protocol}-${msg.data.chatroom}`;

                            chat = new MissionChat({
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
                        } else {
                            chat = new DirectChat({ ...msg.data, from });
                        }

                        if (msg.data.location && msg.data.location[0] !== 0 && msg.data.location[1] !== 0) {
                            chat.position(msg.data.location);
                        }

                        const feat = await CoTParser.to_geojson(chat);
                        const messageId = feat.properties.chat ? (feat.properties.chat.messageId || randomUUID()) : randomUUID();

                        let status = ProfileChatStatus.FAILED;

                        if (client.ready) {
                            try {
                                await client.tak.write([chat], { stripFlow: true });
                                status = ProfileChatStatus.SENT;
                            } catch (err) {
                                console.error(`Error: Failed to write Chat ${messageId}:`, err);
                            }
                        }

                        let created = new Date().toISOString();

                        // Mission chat is stored by the Mission, not the profile
                        if (profile && !msg.data.mission) {
                            const stored = await client.config.config.models.ProfileChat.ingest({
                                username: profile.id,
                                chatroom: msg.data.chatroom,
                                sender_callsign: from.callsign,
                                sender_uid: from.uid,
                                message_id: messageId,
                                message: msg.data.message,
                                read: true,
                                status,
                            }, { restatus: true });

                            created = new Date(stored.chat.created).toISOString();
                        }

                        // Tell all of the user's clients whether the message reached the TAK Server
                        // Includes the server-assigned created so clients can replace their
                        // optimistic local-clock timestamp with the authoritative one
                        for (const wsClient of (client.config.config.wsClients.get(String(client.config.id)) || [])) {
                            if (!wsClient.events.includes(WebSocket_Event.MAP)) continue;

                            if (wsClient.format === 'geojson') {
                                wsClient.ws.send(JSON.stringify({
                                    type: 'chat:receipt',
                                    connection: client.config.id,
                                    data: {
                                        messageId,
                                        status,
                                        chatroom: msg.data.chatroom,
                                        created,
                                    },
                                }));
                            }
                        }
                    } else {
                        const feat = msg.data as Static<typeof Feature.Feature>;

                        const cot = await CoTParser.from_geojson(feat);

                        void client.tak.write([cot], { stripFlow: true });
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

    destroy() {
        this.ws.close();
        delete this.client;
    }
}

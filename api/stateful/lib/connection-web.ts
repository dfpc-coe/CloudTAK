import { Static } from '@sinclair/typebox';
import { randomUUID } from 'node:crypto';
import { DirectChat, MissionChat, CoTParser } from '@tak-ps/node-cot';
import type { Feature } from '@tak-ps/node-cot';
import WebSocket from 'ws';
import { ConnectionClient } from './connection-pool.js';
import { ProfileConnConfig } from '../../common/connection-config.js';
import { sourceOf } from './location-arbiter.js';
import { ProfileChatStatus, WebSocket_Event } from '../../common/enums.js';
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

                        // TAK Server plugins (e.g. tak-gpt) route by callsign, searching the
                        // whole xmlDetail string for `dest callsign="..."`. Add a callsign
                        // dest alongside the UID-based <marti><dest uid="..."/> that
                        // DirectChat's constructor already set, so those plugins can still
                        // find a match.
                        //
                        // IMPORTANT: never *replace* the existing marti.dest array here. The
                        // UID-based dest is what TAK Server's explicit-brokering path uses to
                        // deliver directed chats collision-free (client UIDs are unique).
                        // Callsigns are user-editable display strings that are not unique
                        // (e.g. every new CloudTAK profile defaults to "CloudTAK User"), and
                        // TAK Server resolves callsign destinations via a single global
                        // callsign -> subscription map that gets overwritten whenever any
                        // client sets/changes its callsign. Overwriting the dest array with a
                        // callsign-only entry can misroute the message to an unrelated user.
                        //
                        // Note: <marti> is NOT stripped before TAK Server builds xmlDetail —
                        // confirmed against StreamingProtoBufHelper.cot2protoBuf(), which only
                        // extracts a fixed allowlist of known detail elements (contact, __group,
                        // precisionlocation, status, takv, track) and passes everything else,
                        // including <marti>, straight through into xmlDetail verbatim. So
                        // addDest() alone is sufficient; no separate bare <dest> sibling under
                        // <detail> is needed for plugins that substring-search xmlDetail.
                        if (msg.data.to?.callsign && chat instanceof DirectChat) {
                            chat.addDest({ callsign: msg.data.to.callsign });
                        }

                        void client.tak.write([chat], { stripFlow: true });

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
                            if (!wsClient.events.includes(WebSocket_Event.MAP)) continue;

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
                    } else if (msg.type === 'broadcast:claim') {
                        // Take over / Resume: this session asks to be the location broadcaster
                        if (client.config instanceof ProfileConnConfig && this.session) {
                            client.config.config.locationArbiter.claim(String(client.config.id), this.session);
                        }
                    } else {
                        const feat = msg.data as Static<typeof Feature.Feature>;

                        const cot = await CoTParser.from_geojson(feat);

                        // TAK.NZ: the user's own position goes through the broadcaster check
                        let relay = false;
                        const loose = feat as { id?: unknown; properties?: { id?: unknown; ce?: unknown }; geometry?: { coordinates?: unknown } };
                        if (client.config instanceof ProfileConnConfig && (loose.id ?? loose.properties?.id) === client.config.uid()) {
                            const arbiter = client.config.config.locationArbiter;
                            const { source, accuracy } = sourceOf(loose.geometry?.coordinates, loose.properties?.ce);
                            const gate = arbiter.gate(String(client.config.id), {
                                session: this.session,
                                source,
                                accuracy,
                                channel: 'ws',
                            });
                            if (!gate.forward) return;
                            relay = arbiter.mode === 'enforce' && !!gate.decision?.accept;
                        }

                        void client.tak.write([cot], { stripFlow: true });

                        if (relay) {
                            // TAK Server does not echo to the sender: show this position on the
                            // user's other sessions too
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

    destroy() {
        this.ws.close();
        delete this.client;
    }
}

import { Static } from '@sinclair/typebox'
import CoT, { DirectChat, Feature }  from '@tak-ps/node-cot';
import { WebSocket } from 'ws';
import { ConnectionClient } from './connection-pool.js';

export class ConnectionWebSocket {
    ws: WebSocket;
    format: string;
    client?: ConnectionClient;

    constructor(ws: WebSocket, format = 'raw', client?: ConnectionClient) {
        this.ws = ws;
        this.format = format;

        if (client) {
            this.client = client;
            this.ws.on('message', async (data) => {
                try {
                    const msg = JSON.parse(String(data));

                    if (msg.type === 'chat') {
                        const chat = new DirectChat(msg.data);
                        client.tak.write([chat]);

                        const feat = chat.to_geojson();
                        await client.config.config.models.ProfileChat.generate({
                            username: String(client.config.id),
                            chatroom: msg.data.chatroom,
                            sender_callsign: msg.data.from.callsign,
                            sender_uid: msg.data.from.uid,
                            message_id: feat.properties.chat.messageId,
                            message: msg.data.message
                        })
                    } else {
                        const feat = msg.data as Static<typeof Feature>;

                        const cot = CoT.from_geojson(feat);
                        client.tak.write([cot]);
                    }
                } catch (err) {
                    this.ws.send(JSON.stringify({
                        type: 'Error',
                        properties: {
                            message: err instanceof Error ? err.message : String(err)
                        }
                    }));
                }
            });
        }
    }
}

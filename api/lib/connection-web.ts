import { Feature } from 'geojson';
import { CoT } from '@tak-ps/node-tak';
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
            this.ws.on('message', (data) => {
                const msg = JSON.parse(String(data));

                if (msg.type === 'chat') {
                    console.error('CHAT');
                } else {
                    const feat = msg.data as Feature;

                    try {
                        const cot = CoT.from_geojson(feat);
                        if (this.client) this.client.tak.write([cot]);
                    } catch (err) {
                        this.ws.send(JSON.stringify({
                            type: 'Error',
                            properties: {
                                message: err instanceof Error ? err.message : String(err)
                            }
                        }));
                    }
                }
            });
        }
    }
}

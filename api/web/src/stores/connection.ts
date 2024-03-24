import { defineStore } from 'pinia'
import pointOnFeature from '@turf/point-on-feature';
import { std, stdurl } from '../std.ts';
import moment from 'moment';
import type { Feature } from 'geojson';
import { useCOTStore } from './cots.ts';
const cotStore = useCOTStore();

export const useConnectionStore = defineStore('connection', {
    state: (): {
        ws?: WebSocket
    } => {
        return {
            ws: undefined
        }
    },
    actions: {
        connectSocket: function(connection: string) {
            const url = stdurl('/api');
            url.searchParams.append('format', 'geojson');
            url.searchParams.append('connection', connection);
            url.searchParams.append('token', localStorage.token);

            if (window.location.hostname === 'localhost') {
                url.protocol = 'ws:';
            } else {
                url.protocol = 'wss:';
            }

            this.ws = new WebSocket(url);
            this.ws.addEventListener('error', (err) => {
                console.error(err);
                this.$emit('err')
            });

            this.ws.addEventListener('close', () => {
                // Otherwise the user is probably logged out
                if (localStorage.token) this.connectSocket();
            });
            this.ws.addEventListener('message', (msg) => {
                msg = JSON.parse(msg.data);
                if (msg.type === 'Error') throw new Error(msg.properties.message);

                if (msg.type === 'cot') {
                    cotStore.add(msg.data);
                } else if (msg.type === 'chat') {
                    console.log(msg.data);
                } else {
                    console.log('UNKNOWN', msg.data);
                }
            });
        },
        sendCOT: function(cot) {
            if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
            this.ws.send(JSON.stringify({
                type: 'cot',
                data: cot
            }));
        },
    }
})

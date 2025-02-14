/*
* ConnectionStore - Maintain the WebSocket connection with CloudTAK Server
*/

import { defineStore } from 'pinia'
import * as Comlink from 'comlink';
import { useCOTStore } from './cots.ts';
import { stdurl } from '../std.ts'
import { useProfileStore } from './profile.ts';

import ConnectionWorker from '../workers/connection.ts?worker&url';

export const useConnectionStore = defineStore('connection', {
    state: function() {
        const worker = new Worker(ConnectionWorker, {
            type: 'module'
        });

        const com = Comlink.wrap(worker);

        return { com };
    },
    actions: {
        isOpen: async function(): Promise<boolean> {
            return await this.com.isOpen()
        },
        destroy: async function(): Promise<void> {
            await this.com.destroy();
        },
        connectSocket: async function(connection: string): Promise<void> {
            await this.com.connect(connection);
        },
        sendCOT: async function(data: object, type = 'cot'): Promise<void> {
            await this.com.sendCOT(data, type);
        }
    }
})

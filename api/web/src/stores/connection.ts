/*
* ConnectionStore - Maintain the WebSocket connection with CloudTAK Server
*/

import { defineStore } from 'pinia'
import { useProfileStore } from './profile.ts';
import * as Comlink from 'comlink';
import COT from './base/cot.ts';

import ConnectionWorker from '../workers/connection.ts?worker&url';

export const useConnectionStore = defineStore('connection', {
    state: function() {
        const profileStore = useProfileStore();

        const worker = new Worker(ConnectionWorker, {
            type: 'module'
        });

        worker.addEventListener("cloudtak:notification", (event) => {
            profileStore.pushNotification(event);
        });

        worker.addEventListener("cloudtak:map:diff", (event) => {
            profileStore.pushNotification(event);
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
        loadArchive: async function(): Promise<void> {
            await this.com.loadArchive();
        },
        connectSocket: async function(connection: string): Promise<void> {
            await this.com.connect(connection, localStorage.token);
        },
        sendCOT: async function(cot: COT, type = 'cot'): Promise<void> {
            await this.com.sendCOT(cot.as_feature({ clone: true }), type);
        }
    }
})

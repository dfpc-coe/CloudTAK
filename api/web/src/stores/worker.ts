/*
* ConnectionStore - Maintain the WebSocket connection with CloudTAK Server
*/

import { defineStore } from 'pinia'
import { useProfileStore } from './profile.ts';
import * as Comlink from 'comlink';
import COT from './base/cot.ts';

import AtlasWorker from '../workers/atlas.ts?worker&url';

export const useMapWorkerStore = defineStore('MapWorkerStore', {
    state: function() {
        const profileStore = useProfileStore();

        const worker = new Worker(AtlasWorker, {
            type: 'module'
        });

        worker.addEventListener("cloudtak:notification", (event) => {
            profileStore.pushNotification(event);
        });

        const com = Comlink.wrap(worker);

        return { com };
    },
    actions: {
        isOpen: async function(): Promise<boolean> {
            return await this.com.isOpen()
        },
        add: async function(feat): Promise<void> {
            // TODO this shouldn't happen
            if (!feat) return;
            await this.com.add(feat);
        },
        destroy: async function(): Promise<void> {
            await this.com.destroy();
        },
        diff: async function(): Promise<unknown> {
            return this.com.diff();
        },
        loadArchive: async function(): Promise<void> {
            await this.com.loadArchive(localStorage.token);
        },
        connectSocket: async function(connection: string): Promise<void> {
            await this.com.connect(connection, localStorage.token);
        },
        sendCOT: async function(cot: COT, type = 'cot'): Promise<void> {
            if (!cot) return;
            await this.com.sendCOT(cot.as_feature({ clone: true }), type);
        }
    }
})

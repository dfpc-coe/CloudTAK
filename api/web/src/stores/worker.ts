/*
* ConnectionStore - Maintain the WebSocket connection with CloudTAK Server
*/

import { defineStore } from 'pinia'
import { useProfileStore } from './profile.ts';
import * as Comlink from 'comlink';

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

        return {
            worker: com
        };
    }
})

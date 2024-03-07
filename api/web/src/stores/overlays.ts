import { defineStore } from 'pinia'
import { std } from '../std.js';
import * as pmtiles from 'pmtiles';
import pointOnFeature from '@turf/point-on-feature';
import { useCOTStore } from './cots.js'
const cotStore = useCOTStore();

export const useOverlayStore = defineStore('overlays', {
    state: () => {
        return {
            initialized: false,
            overlays: [],
            subscriptions: new Map() // By GUID
        }
    },
    actions: {
        saveOverlay: async function(layer) {
            const overlay = await std('/api/profile/overlay', {
                method: 'POST',
                body: layer
            });

            await this.list()

            return overlay.id;
        },
        deleteOverlay: async function(overlay_id) {
            await std(`/api/profile/overlay?id=${overlay_id}`, {
                method: 'DELETE'
            });

            await this.list()
        },
        list: async function() {
            this.overlays = (await std(`/api/profile/overlay`)).items;

            this.subscriptions.clear();
            for (const overlay of this.overlays) {
                if (overlay.mode === 'mission') {
                    // mode_id is GUID for mission type
                    this.subscriptions.set(overlay.mode_id, overlay);
                    // @TODO Eventually allow name changes so use GUID
                    await cotStore.loadMission(overlay.name);
                }
            }

            this.initialized = true;
        }
    },
})

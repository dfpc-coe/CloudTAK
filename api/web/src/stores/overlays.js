import { defineStore } from 'pinia'
import * as pmtiles from 'pmtiles';
import mapgl from 'maplibre-gl'
import * as terraDraw from 'terra-draw';
import pointOnFeature from '@turf/point-on-feature';

export const useOverlayStore = defineStore('overlays', {
    state: () => {
        return {
            initialized: false,
            subscriptions: new Map()
        }
    },
    actions: {
        saveOverlay: async function(layer) {
            const overlay = await window.std('/api/profile/overlay', {
                method: 'POST',
                body: layer
            });

            await this.list()

            return overlay.id;
        },
        deleteOverlay: async function(overlay_id) {
            await window.std(`/api/profile/overlay?id=${overlay_id}`, {
                method: 'DELETE'
            });

            await this.list()
        },
        list: async function() {
            const list = await window.std(`/api/profile/overlay`);
            this.subscriptions.clear();
            for (const sub of list.items) {
                if (sub.mode === 'mission') {
                    // mode_id is GUID for mission type
                    this.subscriptions.set(sub.mode_id, sub);
                }
            }
            this.initialized = true;
        }
    },
})

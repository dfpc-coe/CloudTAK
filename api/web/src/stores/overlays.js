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

            return overlay.id;
        },
        deleteOverlay: async function(overlay_id) {
            await window.std(`/api/profile/overlay?id=${overlay_id}`, {
                method: 'DELETE'
            });
        },
        list: async function() {
            const list = await window.std(`/api/profile/overlay`);
            this.subscriptions.clear();
            for (const sub of list.items) {
                if (sub.mode === 'mission') {
                    this.subscriptions.set(sub.guid, sub);
                }
            }
            this.initialized = true;
        },
        subscribe: async function(mission) {
            if (!this.initialized) await this.list();

            if (this.subscriptions.has(mission.guid)) return;

            const list = await window.std(`/api/profile/sub`, {
                method: 'POST',
                body: {
                    mission: mission.name,
                    guid: mission.guid
                }
            });

            await this.list()
        },
        unsubscribe: async function(mission) {
            if (!this.initialized) await this.list();

            if (!this.subscriptions.has(mission.guid)) return;

            const url = await window.stdurl(`/api/profile/sub`);
            url.searchParams.append('guid', mission.guid);
            const list = await window.std(url, {
                method: 'DELETE'
            });

            await this.list();
        }
    },
})

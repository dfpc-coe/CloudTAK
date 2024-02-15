import { defineStore } from 'pinia'
import * as pmtiles from 'pmtiles';
import mapgl from 'maplibre-gl'
import * as terraDraw from 'terra-draw';
import pointOnFeature from '@turf/point-on-feature';

export const useSubStore = defineStore('subscriptions', {
    state: () => {
        return {
            initialized: false
            subscriptions: [],
        }
    },
    actions: {
        list: async function(overlay_id) {
            const list = await window.std(`/api/profile/sub`);
            this.subscriptions = list.items;
            this.initialized = true;
        },
        subscribe: async function() {
            if (!this.initialized) await this.list();
        }
        unsubscribe: async function() {
            if (!this.initialized) await this.list();
        }
    },
})

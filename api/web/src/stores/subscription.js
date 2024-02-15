import { defineStore } from 'pinia'
import * as pmtiles from 'pmtiles';
import mapgl from 'maplibre-gl'
import * as terraDraw from 'terra-draw';
import pointOnFeature from '@turf/point-on-feature';

export const useSubStore = defineStore('subscriptions', {
    state: () => {
        return {
            initialized: false,
            subscriptions: new Map()
        }
    },
    actions: {
        list: async function() {
            const list = await window.std(`/api/profile/sub`);
            this.subscriptions.clear();
            for (const sub of list.items) {
                this.subscriptions.set(sub.guid, sub);
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

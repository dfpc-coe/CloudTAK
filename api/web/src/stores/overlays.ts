import { defineStore } from 'pinia'
import { std, stdurl } from '../std.js';
import * as pmtiles from 'pmtiles';
import pointOnFeature from '@turf/point-on-feature';
import { useCOTStore } from './cots.js'
const cotStore = useCOTStore();
import type { ProfileOverlay, ProfileOverlay_Update, ProfileOverlay_Create } from '../types.js';
import type { Static } from '@sinclair/typebox';

export const useOverlayStore = defineStore('overlays', {
    state: (): {
        overlays: ProfileOverlay[],
    } => {
        return {
            initialized: false,
            overlays: [],
        }
    },
    actions: {
        saveOverlay: async function(container: ProfileOverlay_Create): Promise<number> {
            const overlay = await std('/api/profile/overlay', {
                method: 'POST',
                body: container
            });

            await this.list()

            return overlay.id;
        },
        updateOverlay: async function(overlay_id: number, container: ProfileOverlay_Update): Promise<number> {
            const overlay = await std(`/api/profile/overlay/${overlay_id}`, {
                method: 'PATCH',
                body: container
            });

            await this.list()

            return overlay.id;
        },
        deleteOverlay: async function(overlay_id: number): Promise<void> {
            await std(`/api/profile/overlay?id=${overlay_id}`, {
                method: 'DELETE'
            });

            await this.list()
        },
        list: async function() {
            const url = stdurl('/api/profile/overlay');
            url.searchParams.append('sort', 'pos');
            url.searchParams.append('order', 'asc');

            // @ts-ignore Eventually Type API reqs
            this.overlays = (await std(url)).items;

            this.initialized = true;
        }
    },
})

import { defineStore } from 'pinia'
import { std } from '../std.js';
import * as pmtiles from 'pmtiles';
import pointOnFeature from '@turf/point-on-feature';
import { useCOTStore } from './cots.js'
const cotStore = useCOTStore();
import type { ProfileOverlay } from '../types.js';
import type { Static } from '@sinclair/typebox';

export const useOverlayStore = defineStore('overlays', {
    state: (): {
        initialized: boolean;
        overlays: ProfileOverlay[],
        subscriptions: Map<string, ProfileOverlay>
    } => {
        return {
            initialized: false,
            overlays: [],
            subscriptions: new Map() // By GUID
        }
    },
    actions: {
        saveOverlay: async function(container: ProfileOverlay): Promise<number> {
            const overlay = await std('/api/profile/overlay', {
                method: 'POST',
                body: container
            });

            await this.list()

            return overlay.id;
        },
        updateOverlay: async function(container: ProfileOverlay): Promise<number> {
            const overlay = await std(`/api/profile/overlay/${container.id}`, {
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
            // @ts-ignore Eventually Type API reqs
            this.overlays = (await std(`/api/profile/overlay`)).items;

            this.subscriptions.clear();
            for (const overlay of this.overlays) {
                if (overlay.mode === 'mission' && overlay.mode_id) {
                    // mode_id is GUID for mission type
                    this.subscriptions.set(overlay.mode_id, overlay);
                    await cotStore.loadMission(overlay.mode_id);
                }
            }

            this.initialized = true;
        }
    },
})

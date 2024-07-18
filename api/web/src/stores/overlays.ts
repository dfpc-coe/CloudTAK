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
        initialized: boolean;
        overlays: ProfileOverlay[];
    } => {
        return {
            initialized: false,
            overlays: [],
        }
    },
    actions: {
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

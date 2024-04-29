import { defineStore } from 'pinia'
import { GeoJSONSourceDiff } from 'maplibre-gl';
import pointOnFeature from '@turf/point-on-feature';
import { std, stdurl } from '../std.ts';
import moment from 'moment';
import type { Feature } from 'geojson';
import { useProfileStore } from './profile.js';
const profileStore = useProfileStore();

export const useCOTStore = defineStore('cots', {
    state: (): {
        archive: Map<string, Feature>;
        cots: Map<string, Feature>;

        // COTs are submitted to pending and picked up by the partial update code every .5s
        pending: Map<string, Feature>;
        pendingDelete: Set<string>;
        subscriptions: Map<string, Map<string, Feature>>;
    } => {
        return {
            archive: new Map(),         // Store all archived CoT messages
            cots: new Map(),            // Store all on-screen CoT messages
            pending: new Map(),         // Store yet to be rendered on-screen CoT Messages
            pendingDelete: new Set(),   // Store yet to be deleted on-screen CoT Messages
            subscriptions: new Map()    // Store All Mission CoT messages by GUID
        }
    },
    actions: {
        /**
         * Load Archived CoTs from localStorage
         */
        loadArchive: function(): void {
            const archive = JSON.parse(localStorage.getItem('archive') || '[]');
            for (const a of archive) {
                this.archive.set(a.id, a);
                this.pending.set(a.id, a);
            }
        },

        /**
         * Load Latest CoTs from Mission Sync
         */
        loadMission: async function(guid: string): Promise<void> {
             try {
                 const fc = await std(`/api/marti/missions/${encodeURIComponent(guid)}/cot`);
                 for (const feat of fc.features) this.add(feat, guid);
             } catch (err) {
                console.error(err);
            }
        },

        /**
         * Save Archived CoTs from localStorage - called automatically every time an
         * archived CoT changes
         */
        saveArchive: function(): void {
            localStorage.setItem('archive', JSON.stringify(Array.from(this.archive.values())))
        },

        /**
         * Generate a GeoJSONDiff on existing COT Features
         */
        diff: function(): GeoJSONSourceDiff {
            const now = moment();
            const diff = {
                add: [],
                remove: [],
                update: []
            }

            for (const cot of this.cots.values()) {
                if (
                    profileStore.profile.display_stale === 'Immediate'
                    && !cot.properties.archived
                    && now.isAfter(cot.properties.stale)
                ) {
                    diff.remove.push(cot.id);
                } else if (
                    !['Never', 'Immediate'].includes(profileStore.profile.display_stale)
                    && !cot.properties.archived
                    && !now.isBefore(moment(cot.properties.stale).add(...profileStore.profile.display_stale.split(' ')))
                ) {
                    diff.remove.push(cot.id)
                } else if (!cot.properties.archived) {
                    if (now.isBefore(moment(cot.properties.stale)) && (cot.properties['icon-opacity'] !== 1 || cot.properties['circle-opacity'] !== 255)) {
                         cot.properties['icon-opacity'] = 1;
                         cot.properties['circle-opacity'] = 255;
                        diff.update.push(cot)
                    } else if (!now.isBefore(moment(cot.properties.stale)) && (cot.properties['icon-opacity'] !== 0.5 || cot.properties['circle-opacity'] !== 127)) {
                         cot.properties['icon-opacity'] = 0.5;
                         cot.properties['circle-opacity'] = 127;
                        diff.update.push(cot)
                    }
                }
            }

            return diff;
        },

        /**
         * Return a FeatureCollection of a non-default CoT Store
         */
        collection(store) {
            return {
                type: 'FeatureCollection',
                features: Array.from(store.values())
            }
        },

        /**
         * Update a feature that exists in the store - bypasses feature standardization
         */
        update: function(feat: Feature): void {
            this.pending.set(feat.id, feat);

            if (feat.properties.archived) {
                this.archive.set(feat.id, feat);
                this.saveArchive();
            }
        },
        /**
         * Return a CoT by ID if it exists
         */
        get: function(id: string): Feature {
            return this.cots.get(id);
        },
        /**
         * Returns if the CoT is present in the store given the ID
         */
        has: function(id: string) {
            return this.cots.has(id);
        },
        /**
         * Remove a given CoT from the store
         */
        delete: function(id: string) {
            this.pendingDelete.add(id);
            if (this.archive.has(id)) {
                this.archive.delete(id);
                this.saveArchive();
            }
        },
        /**
         * Empty the store
         */
        clear: function(): void {
            this.cots.clear();
            this.archive.clear();
            localStorage.removeItem('archive');
        },

        /**
         * Add a CoT GeoJSON to the store and modify props to meet MapLibre style requirements
         */
        add: function(feat: Feature, mission_guid=null) {
            if (!feat.id && !feat.properties.id) {
                feat.id = self.crypto.randomUUID();
            }

            //Vector Tiles only support integer IDs
            feat.properties.id = feat.id;

            if (!feat.properties) feat.properties = {};

            if (!feat.properties.center) {
                feat.properties.center = pointOnFeature(feat.geometry).geometry.coordinates;
            }

            if (!feat.properties.time) feat.properties.time = new Date().toISOString();
            if (!feat.properties.start) feat.properties.start = new Date().toISOString();
            if (!feat.properties.stale) feat.properties.stale = moment().add(10, 'minutes').toISOString();

            if (!feat.properties.remarks) {
                feat.properties.remarks = 'None';
            }

            if (feat.geometry.type.includes('Point')) {
                if (feat.properties.group) {
                    feat.properties['icon-opacity'] = 0;

                    if (feat.properties.group.name === 'Yellow') {
                        feat.properties.color = '#f59f00';
                    } else if (feat.properties.group.name === 'Orange') {
                        feat.properties.color = '#f76707';
                    } else if (feat.properties.group.name === 'Magenta') {
                        feat.properties.color = '#ea4c89';
                    } else if (feat.properties.group.name === 'Red') {
                        feat.properties.color = '#d63939';
                    } else if (feat.properties.group.name === 'Maroon') {
                        feat.properties.color = '#bd081c';
                    } else if (feat.properties.group.name === 'Purple') {
                        feat.properties.color = '#ae3ec9';
                    } else if (feat.properties.group.name === 'Dark Blue') {
                        feat.properties.color = '#0054a6';
                    } else if (feat.properties.group.name === 'Blue') {
                        feat.properties.color = '#4299e1';
                    } else if (feat.properties.group.name === 'Cyan') {
                        feat.properties.color = '#17a2b8';
                    } else if (feat.properties.group.name === 'Teal') {
                        feat.properties.color = '#0ca678';
                    } else if (feat.properties.group.name === 'Green') {
                        feat.properties.color = '#74b816';
                    } else if (feat.properties.group.name === 'Dark Green') {
                        feat.properties.color = '#2fb344';
                    } else if (feat.properties.group.name === 'Brown') {
                        feat.properties.color = '#dc4e41';
                    } else {
                        feat.properties.color = '#ffffff';
                    }

                } else if (feat.properties.icon) {
                    // Format of icon needs to change for spritesheet
                    feat.properties.icon = feat.properties.icon.replace('/', ':').replace(/.png$/, '');
                } else {
                    // TODO Only add icon if one actually exists in the spritejson
                    if (!['u-d-p'].includes(feat.properties.type)) {
                        feat.properties.icon = `${feat.properties.type}`;
                    }
                }
            } else if (feat.geometry.type.includes('Line') || feat.geometry.type.includes('Polygon')) {
                if (!feat.properties['stroke']) feat.properties.stroke = '#d63939';
                if (!feat.properties['stroke-style']) feat.properties['stroke-style'] = 'solid';
                if (!feat.properties['stroke-width']) feat.properties['stroke-width'] = 3;

                if (feat.properties['stroke-opacity']) {
                    feat.properties['stroke-opacity'] = feat.properties['stroke-opacity']
                } else {
                    feat.properties['stroke-opacity'] = 255;
                }

                if (feat.geometry.type.includes('Polygon')) {
                    if (!feat.properties['fill']) feat.properties.fill = '#d63939';

                    if (feat.properties['fill-opacity']) {
                        feat.properties['fill-opacity'] = feat.properties['fill-opacity']
                    } else {
                        feat.properties['fill-opacity'] = 255;
                    }
                }
            }

            if (mission_guid)  {
                let cots = this.subscriptions.get(mission_guid);
                if (!cots) {
                    cots = new Map();
                    this.subscriptions.set(mission_guid, cots);
                }

                cots.set(feat.id, feat);
            } else {
                this.pending.set(feat.id, feat);

                if (feat.properties.archived) {
                    this.archive.set(feat.id, feat);
                    this.saveArchive();
                }
            }
        }
    }
})

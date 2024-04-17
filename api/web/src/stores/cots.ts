import { defineStore } from 'pinia'
import pointOnFeature from '@turf/point-on-feature';
import { std, stdurl } from '../std.ts';
import moment from 'moment';
import type { Feature } from 'geojson';
import { useProfileStore } from './profile.js';
const profileStore = useProfileStore();


/**
 * modify props to meet CoT style requirements
 */
export function extract(feat: Feature) {
    feat = JSON.parse(JSON.stringify(feat));
    if (feat.properties['stroke-opacity']) feat.properties['stroke-opacity'] = feat.properties['stroke-opacity'] * 255;
    if (feat.properties['fill-opacity']) feat.properties['fill-opacity'] = feat.properties['fill-opacity'] * 255;
    return feat;
}

export const useCOTStore = defineStore('cots', {
    state: (): {
        archive: Map<string, Feature>;
        cots: Map<string, Feature>;
        subscriptions: Map<string, Map<string, Feature>>;
    } => {
        return {
            archive: new Map(),     // Store all archived CoT messages
            cots: new Map(),        // Store all on-screen CoT messages
            subscriptions: new Map()     // Store All Mission CoT messages by GUID
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
                this.cots.set(a.id, a);
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
         * Return CoTs as a FeatureCollection
         */
        collection: function(store) {
            if (!store) {
                const now = moment();
                return {
                    type: 'FeatureCollection',
                    features:  Array.from(this.cots.values()).filter((cot) => {
                        if (profileStore.profile.display_stale === 'Immediate' && now.isAfter(cot.properties.stale)) {
                            return false;
                        } else if (!['Never', 'Immediate'].includes(profileStore.profile.display_stale)) {
                            return now.isBefore(moment(cot.properties.stale).add(...profileStore.profile.display_stale.split(' ')))
                        }

                        return true;
                    }).map((cot) => {
                        if (!cot.properties.archived) {
                            cot.properties['icon-opacity'] = now.isBefore(moment(cot.properties.stale)) ? 1 : 0.5;
                            cot.properties['circle-opacity'] = now.isBefore(moment(cot.properties.stale)) ? 1 : 0.5;
                        }
                        return cot;
                    })
                }
            } else {
                return {
                    type: 'FeatureCollection',
                    features: Array.from(store.values())
                }
            }
        },

        /**
         * Update a feature that exists in the store - bypasses feature standardization
         */
        update: function(feat: Feature): void {
            this.cots.set(feat.id, feat);

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
            this.cots.delete(id);
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

                // MapLibre Opacity must be of range 0-1
                if (feat.properties['stroke-opacity']) {
                    feat.properties['stroke-opacity'] = feat.properties['stroke-opacity'] / 255;
                } else {
                    feat.properties['stroke-opacity'] = 1;
                }

                if (feat.geometry.type.includes('Polygon')) {
                    if (!feat.properties['fill']) feat.properties.fill = '#d63939';

                    if (feat.properties['fill-opacity']) {
                        feat.properties['fill-opacity'] = feat.properties['fill-opacity'] / 255;
                    } else {
                        feat.properties['fill-opacity'] = 1;
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
                this.cots.set(feat.id, feat);

                if (feat.properties.archived) {
                    this.archive.set(feat.id, feat);
                    this.saveArchive();
                }
            }
        }
    }
})

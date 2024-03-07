import { defineStore } from 'pinia'
import pointOnFeature from '@turf/point-on-feature';
import { std, stdurl } from '../std.js';
import moment from 'moment';

export const useCOTStore = defineStore('cots', {
    state: () => {
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
        loadArchive: function() {
            const archive = JSON.parse(localStorage.getItem('archive') || '[]');
            for (const a of archive) {
                this.archive.set(a.id, a);
                this.cots.set(a.id, a);
            }
        },

        /**
         * Load Latest CoTs from Mission Sync
         */
        loadMission: async function(guid) {
             try {
                 const fc = await window.std(`/api/marti/missions/${encodeURIComponent(guid)}/cot`);
                 if (!this.subscriptions.has(guid)) this.subscriptions.set(guid, new Map());
                 const cots = this.subscriptions.get(guid);
                 cots.clear();
                 for (const feat of fc.features) cots.set(feat.id, feat);
             } catch (err) {
                console.error(err);
            }
        },

        /**
         * Save Archived CoTs from localStorage - called automatically every time an
         * archived CoT changes
         */
        saveArchive: function() {
            localStorage.setItem('archive', JSON.stringify(Array.from(this.archive.values())))
        },

        /**
         * Return CoTs as a FeatureCollection
         */
        collection: function(store) {
            if (!store) {
                return {
                    type: 'FeatureCollection',
                    features:  Array.from(this.cots.values()).map((cot) => {
                        // TODO if not archived set color opacity
                        cot.properties['icon-opacity'] = moment().subtract(5, 'minutes').isBefore(moment(cot.properties.stale)) ? 1 : 0.5;
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
        update: function(feat) {
            this.cots.set(feat.id, feat);

            if (feat.properties.archive) {
                this.archive.set(feat.id, feat);
                this.saveArchive();
            }
        },
        /**
         * Return a CoT by ID if it exists
         */
        get: function(id) {
            return this.cots.get(id);
        },
        /**
         * Returns if the CoT is present in the store given the ID
         */
        has: function(id) {
            return this.cots.has(id);
        },
        /**
         * Remove a given CoT from the store
         */
        delete: function(id) {
            this.cots.delete(id);
            if (this.archive.has(id)) {
                this.archive.delete(id);
                this.saveArchive();
            }
        },
        /**
         * Empty the store
         */
        clear: function() {
            this.cots.clear();
            this.archive.clear();
            localStorage.removeItem('archive');
        },
        /**
         * Add a CoT GeoJSON to the store and modify props to meet MapLibre style requirements
         */
        add: function(feat, mission_guid=null) {
            //Vector Tiles only support integer IDs
            feat.properties.id = feat.id;

            if (!feat.properties.center) {
                feat.properties.center = pointOnFeature(feat.geometry).geometry.coordinates;
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

                if (feat.properties.archive) {
                    this.archive.set(feat.id, feat);
                    this.saveArchive();
                }
            }
        }
    }
})

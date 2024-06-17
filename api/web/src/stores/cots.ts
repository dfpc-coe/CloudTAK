/*
* CotStore - Store & perform updates on all underlying CoT Features
*/

import moment from 'moment';
import { defineStore } from 'pinia'
import type { GeoJSONSourceDiff } from 'maplibre-gl';
import pointOnFeature from '@turf/point-on-feature';
import { std, stdurl } from '../std.ts';
import type { Feature } from '../types.ts';
import type { FeatureCollection } from 'geojson';
import { useProfileStore } from './profile.ts';
const profileStore = useProfileStore();

type NestedArray = {
    path: string;
    paths: Array<NestedArray>;
}

export const useCOTStore = defineStore('cots', {
    state: (): {
        archive: Map<string, Feature>;
        cots: Map<string, Feature>;
        hidden: Set<string>;

        // COTs are submitted to pending and picked up by the partial update code every .5s
        pending: Map<string, Feature>;
        pendingDelete: Set<string>;
        subscriptions: Map<string, Map<string, Feature>>;
    } => {
        return {
            archive: new Map(),         // Store all archived CoT messages
            cots: new Map(),            // Store all on-screen CoT messages
            hidden: new Set(),          // Store CoTs that should be hidden
            pending: new Map(),         // Store yet to be rendered on-screen CoT Messages
            pendingDelete: new Set(),   // Store yet to be deleted on-screen CoT Messages
            subscriptions: new Map()    // Store All Mission CoT messages by GUID
        }
    },
    actions: {
        /**
         * Iterate over cot messages and return list of CoTs
         * with Video Streams
         */
        videos: function(): Set<Feature> {
            const videos: Set<Feature> = new Set();
            for (const cot of this.cots.values()) {
                if (cot.properties && cot.properties.video) {
                    videos.add(cot);
                }
            }

            return videos;
        },

        /**
         * Load Archived CoTs from localStorage
         */
        loadArchive: async function(): Promise<void> {
            const archive = await std('/api/profile/feature');
            for (const a of archive.items) this.add(a);
        },

        /**
         * Load Latest CoTs from Mission Sync
         */
        loadMission: async function(guid: string): Promise<FeatureCollection> {
            const fc = await std(`/api/marti/missions/${encodeURIComponent(guid)}/cot`);
            for (const feat of fc.features) this.add(feat, guid);

            let sub = this.subscriptions.get(guid)
            if (!sub) {
                sub = new Map();
                this.subscriptions.set(guid, sub)
            }
            return this.collection(sub)
        },

        /**
         * Generate a GeoJSONDiff on existing COT Features
         */
        diff: function(): GeoJSONSourceDiff {
            const now = moment();
            const diff: GeoJSONSourceDiff = {};
            diff.add = [];
            diff.remove = [];
            diff.update = [];

            const display_stale = profileStore.profile ? profileStore.profile.display_stale : 'Immediate';

            for (const cot of this.cots.values()) {
                if (this.hidden.has(String(cot.id))) {
                    diff.remove.push(String(cot.id))
                } else if (
                    display_stale === 'Immediate'
                    && !cot.properties.archived
                    && now.isAfter(cot.properties.stale)
                ) {
                    diff.remove.push(String(cot.id));
                } else if (
                    !['Never', 'Immediate'].includes(display_stale)
                    && !cot.properties.archived
                    && !now.isBefore(moment(cot.properties.stale).add(...display_stale.split(' ')))
                ) {
                    diff.remove.push(String(cot.id))
                } else if (!cot.properties.archived) {
                    if (now.isBefore(moment(cot.properties.stale)) && (cot.properties['icon-opacity'] !== 1 || cot.properties['marker-opacity'] !== 1)) {
                        cot.properties['icon-opacity'] = 1;
                        cot.properties['marker-opacity'] = 1;

                        if (!['Point', 'Polygon', 'LineString'].includes(cot.geometry.type)) continue;

                        diff.update.push({
                            id: String(cot.id),
                            addOrUpdateProperties: Object.keys(cot.properties).map((key) => {
                                return { key, value: cot.properties ? cot.properties[key] : '' }
                            }),
                            newGeometry: cot.geometry
                        })
                    } else if (!now.isBefore(moment(cot.properties.stale)) && (cot.properties['icon-opacity'] !== 0.5 || cot.properties['marker-opacity'] !== 127)) {
                        cot.properties['icon-opacity'] = 0.5;
                        cot.properties['marker-opacity'] = 0.5;

                        if (!['Point', 'Polygon', 'LineString'].includes(cot.geometry.type)) continue;

                        diff.update.push({
                            id: String(cot.id),
                            addOrUpdateProperties: Object.keys(cot.properties).map((key) => {
                                return { key, value: cot.properties ? cot.properties[key] : '' }
                            }),
                            newGeometry: cot.geometry
                        })
                    }
                }
            }

            return diff;
        },

        paths(store?: Map<string, Feature>): Array<NestedArray> {
            if (!store) store = this.cots;

            const paths = new Set();
            for (const [key, value] of store) {
                if (value.path) paths.add(value.path);
            }

            return Array.from(paths).map((path) => {
                return {
                    path: path,
                    paths: []
                } as NestedArray
            });
        },

        async deletePath(path: string, store?: Map<string, Feature>): Promise<void> {
            if (!store) store = this.cots;

            const url = stdurl('/api/profile/feature')
            url.searchParams.append('path', path);
            await std(url, { method: 'DELETE' });

            for (const [key, value] of store) {
                if (value.path && value.path.startsWith(path)) {
                    this.delete(key, true);
                }
            }
        },

        /**
         * Return a FeatureCollection of a non-default CoT Store
         */
        collection(store: Map<string, Feature>): FeatureCollection {
            return {
                type: 'FeatureCollection',
                features: Array.from(store.values())
            }
        },

        /**
         * Return a CoT by ID if it exists
         */
        get: function(id: string, opts?: {
            clone: boolean
        }): Feature | undefined {
            if (opts && opts.clone) {
                return JSON.parse(JSON.stringify(this.cots.get(id)));
            } else {
                return this.cots.get(id);
            }
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
        delete: async function(id: string, skipNetwork = false) {
            this.pendingDelete.add(id);
            if (this.archive.has(id)) {
                this.archive.delete(id);

                if (!skipNetwork) {
                    await std(`/api/profile/feature/${id}`, {
                        method: 'DELETE'
                    });
                }
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
         * Consistent feature manipulation between add & update
         */
        style: function(feat: Feature): Feature {
            //Vector Tiles only support integer IDs
            feat.properties.id = feat.id;

            if (!feat.properties.center) {
                feat.properties.center = pointOnFeature(feat.geometry).geometry.coordinates;
            }

            if (!feat.properties.time) feat.properties.time = new Date().toISOString();
            if (!feat.properties.start) feat.properties.start = new Date().toISOString();
            if (!feat.properties.stale) feat.properties.stale = moment().add(10, 'minutes').toISOString();

            if (!feat.properties.remarks) {
                feat.properties.remarks = 'None';
            }

            if (!feat.properties.how && feat.properties.type.startsWith('u-')) {
                feat.properties.how = 'h-g-i-g-o';
            } else if (!feat.properties.how) {
                feat.properties.how = 'm-p';
            }

            if (feat.geometry.type.includes('Point')) {
                if (feat.properties.group) {
                    feat.properties['icon-opacity'] = 0;

                    if (feat.properties.group.name === 'Yellow') {
                        feat.properties["marker-color"] = '#f59f00';
                    } else if (feat.properties.group.name === 'Orange') {
                        feat.properties["marker-color"] = '#f76707';
                    } else if (feat.properties.group.name === 'Magenta') {
                        feat.properties["marker-color"] = '#ea4c89';
                    } else if (feat.properties.group.name === 'Red') {
                        feat.properties["marker-color"] = '#d63939';
                    } else if (feat.properties.group.name === 'Maroon') {
                        feat.properties["marker-color"] = '#bd081c';
                    } else if (feat.properties.group.name === 'Purple') {
                        feat.properties["marker-color"] = '#ae3ec9';
                    } else if (feat.properties.group.name === 'Dark Blue') {
                        feat.properties["marker-color"] = '#0054a6';
                    } else if (feat.properties.group.name === 'Blue') {
                        feat.properties["marker-color"] = '#4299e1';
                    } else if (feat.properties.group.name === 'Cyan') {
                        feat.properties["marker-color"] = '#17a2b8';
                    } else if (feat.properties.group.name === 'Teal') {
                        feat.properties["marker-color"] = '#0ca678';
                    } else if (feat.properties.group.name === 'Green') {
                        feat.properties["marker-color"] = '#74b816';
                    } else if (feat.properties.group.name === 'Dark Green') {
                        feat.properties["marker-color"] = '#2fb344';
                    } else if (feat.properties.group.name === 'Brown') {
                        feat.properties["marker-color"] = '#dc4e41';
                    } else {
                        feat.properties["marker-color"] = '#ffffff';
                    }

                } else if (feat.properties.icon) {
                    // Format of icon needs to change for spritesheet
                    if (!feat.properties.icon.includes(':')) {
                        feat.properties.icon = feat.properties.icon.replace('/', ':')
                    }

                    if (feat.properties.icon.endsWith('.png')) {
                        feat.properties.icon = feat.properties.icon.replace(/.png$/, '');
                    }
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

                if (!feat.properties['stroke-opacity'] === undefined) {
                    feat.properties['stroke-opacity'] = 1;
                }

                if (feat.geometry.type.includes('Polygon')) {
                    if (!feat.properties['fill']) feat.properties.fill = '#d63939';

                    if (feat.properties['fill-opacity'] === undefined) {
                        feat.properties['fill-opacity'] = 1;
                    }
                }
            }

            return feat;
        },

        /**
         * Add a CoT GeoJSON to the store and modify props to meet MapLibre style requirements
         */
        add: async function(feat: Feature, mission_guid?: string) {
            if (!feat.id && !feat.properties.id) {
                feat.id = self.crypto.randomUUID();
            }

            feat = this.style(feat);

            if (mission_guid)  {
                let cots = this.subscriptions.get(mission_guid);
                if (!cots) {
                    cots = new Map();
                    this.subscriptions.set(mission_guid, cots);
                }

                cots.set(String(feat.id), feat);
            } else {
                /**
                 * Mission CoTs ideally go to the Mission Layer
                 * TODO: This will only work with existing CoTs in the mission
                 *       New CoTs will not be added to the proper layer
                 */
                let mission_cot = false;
                for (const [key, value] of this.subscriptions) {
                    if (value.has(feat.id)) {
                        value.set(feat.id, feat);
                        mission_cot = true;
                    }
                }

                if (mission_cot) return;

                this.pending.set(String(feat.id), feat);

                if (feat.properties && feat.properties.archived) {
                    this.archive.set(String(feat.id), feat);
                    await std('/api/profile/feature', { method: 'PUT', body: feat })
                }
            }
        }
    }
})

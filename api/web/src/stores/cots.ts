/*
* CotStore - Store & perform updates on all underlying CoT Features
*/

import COT from './cots/cot.ts'
import { defineStore } from 'pinia'
import type { GeoJSONSourceDiff } from 'maplibre-gl';
import { std, stdurl } from '../std.ts';
import type { Feature, Mission, APIList } from '../types.ts';
import type { FeatureCollection } from 'geojson';
import { useProfileStore } from './profile.ts';
const profileStore = useProfileStore();
import { useMapStore } from './map.ts';

type NestedArray = {
    path: string;
    paths: Array<NestedArray>;
}

export const useCOTStore = defineStore('cots', {
    state: (): {
        cots: Map<string, COT>;
        hidden: Set<string>;

        // COTs are submitted to pending and picked up by the partial update code every .5s
        pending: Map<string, COT>;
        pendingDelete: Set<string>;

        subscriptions: Map<string, {
            meta: Mission;
            cots: Map<string, COT>;
        }>;
        subscriptionPending: Map<string, string>;
    } => {
        return {
            cots: new Map(),                // Store all on-screen CoT messages
            hidden: new Set(),              // Store CoTs that should be hidden
            pending: new Map(),             // Store yet to be rendered on-screen CoT Messages
            pendingDelete: new Set(),       // Store yet to be deleted on-screen CoT Messages
            subscriptions: new Map(),       // Store All Mission CoT messages by GUID
            subscriptionPending: new Map()  // Map<uid, guid>
        }
    },
    actions: {
        /**
         * Iterate over cot messages and return list of CoTs
         * with Video Streams
         */
        videos: function(): Set<COT> {
            const videos: Set<COT> = new Set();
            for (const cot of this.cots.values()) {
                if (cot.properties && cot.properties.video) {
                    videos.add(cot);
                }
            }

            return videos;
        },

        subChange: function(task: Feature): void {
            if (task.properties.type === 't-x-m-c' && task.properties.mission && task.properties.mission.missionChanges) {
                let updateGuid;

                for (const change of task.properties.mission.missionChanges) {
                    if (!task.properties.mission.guid) {
                        console.error(`Cannot add ${change.contentUid} to ${JSON.stringify(task.properties.mission)} as no guid was included`);
                        continue;
                    }

                    if (change.type === 'ADD_CONTENT') {
                        this.subscriptionPending.set(change.contentUid, task.properties.mission.guid);
                    } else if (change.type === 'REMOVE_CONTENT') {
                        const sub = this.subscriptions.get(task.properties.mission.guid);
                        if (!sub) {
                            console.error(`Cannot remove ${change.contentUid} from ${task.properties.mission.guid} as it's not in memory`);
                            continue;
                        }

                        sub.cots.delete(change.contentUid);
                        updateGuid = task.properties.mission.guid;
                    }
                }

                if (updateGuid) {
                    const mapStore = useMapStore();
                    mapStore.updateMissionData(updateGuid);
                }
            }
        },

        /**
         * Load Archived CoTs
         */
        loadArchive: async function(): Promise<void> {
            const archive = await std('/api/profile/feature') as APIList<Feature>;
            for (const a of archive.items) this.add(a);
        },

        /**
         * Load Latest CoTs from Mission Sync
         */
        loadMission: async function(guid: string): Promise<FeatureCollection> {
            const fc = await std('/api/marti/missions/' + encodeURIComponent(guid) + '/cot') as FeatureCollection;
            for (const feat of fc.features) this.add(feat as Feature, guid);

            let sub = this.subscriptions.get(guid)

            if (!sub) {
                sub = {
                    meta: await std('/api/marti/missions/' + encodeURIComponent(guid)) as Mission,
                    cots: new Map()
                };

                this.subscriptions.set(guid, sub)
            }

            return this.collection(sub.cots)
        },

        /**
         * Generate a GeoJSONDiff on existing COT Features
         */
        diff: function(): GeoJSONSourceDiff {
            const now = +new Date();
            const diff: GeoJSONSourceDiff = {};
            diff.add = [];
            diff.remove = [];
            diff.update = [];

            const display_stale = profileStore.profile ? profileStore.profile.display_stale : 'Immediate';

            for (const cot of this.cots.values()) {
                const render = cot.as_rendered();
                const stale = new Date(cot.properties.stale).getTime();

                if (this.hidden.has(String(cot.id))) {
                    // TODO check if hidden already
                    diff.remove.push(String(cot.id))
                } else if (
                    !['Never'].includes(display_stale)
                    && !cot.properties.archived
                    && (
                        display_stale === 'Immediate'       && now > stale
                        || display_stale === '10 Minutes'   && now > stale + 600000
                        || display_stale === '30 Minutes'   && now > stale + 600000 * 3
                        || display_stale === '1 Hour'       && now > stale + 600000 * 6
                    )
                ) {
                    diff.remove.push(String(cot.id))
                } else if (!cot.properties.archived) {
                    if (now < stale && (cot.properties['icon-opacity'] !== 1 || cot.properties['marker-opacity'] !== 1)) {
                        cot.properties['icon-opacity'] = 1;
                        cot.properties['marker-opacity'] = 1;

                        if (!['Point', 'Polygon', 'LineString'].includes(cot.geometry.type)) continue;

                        diff.update.push({
                            id: String(render.id),
                            addOrUpdateProperties: Object.keys(render.properties).map((key) => {
                                return { key, value: render.properties ? render.properties[key] : '' }
                            }),
                            newGeometry: render.geometry
                        })
                    } else if (now > stale && (cot.properties['icon-opacity'] !== 0.5 || cot.properties['marker-opacity'] !== 127)) {
                        render.properties['icon-opacity'] = 0.5;
                        render.properties['marker-opacity'] = 0.5;

                        if (!['Point', 'Polygon', 'LineString'].includes(render.geometry.type)) continue;

                        diff.update.push({
                            id: String(render.id),
                            addOrUpdateProperties: Object.keys(render.properties).map((key) => {
                                return { key, value: cot.properties ? render.properties[key] : '' }
                            }),
                            newGeometry: render.geometry
                        })
                    }
                }
            }

            for (const cot of this.pending.values()) {
                const render = cot.as_rendered();

                if (this.cots.has(cot.id)) {
                    diff.update.push({
                        id: String(render.id),
                        addOrUpdateProperties: Object.keys(render.properties).map((key) => {
                            return { key, value: render.properties[key] }
                        }),
                        newGeometry: render.geometry
                    })
                } else {
                    diff.add.push(render);
                }

                this.cots.set(cot.id, cot);
            }

            this.pending.clear();

            for (const id of this.pendingDelete) {
                diff.remove.push(id);
                this.cots.delete(id);
            }

            this.pendingDelete.clear();

            return diff;
        },

        paths(store?: Map<string, COT>): Array<NestedArray> {
            if (!store) store = this.cots;

            const paths = new Set();
            for (const value of store.values()) {
                if (value.path) paths.add(value.path);
            }

            return Array.from(paths).map((path) => {
                return {
                    path: path,
                    paths: []
                } as NestedArray
            });
        },

        markers(store?: Map<string, COT>): Array<string> {
            if (!store) store = this.cots;

            const markers: Set<string> = new Set();
            for (const value of store.values()) {
                if (value.properties.group) continue;
                if (value.properties.archived) continue;
                markers.add(value.properties.type);
            }

            return Array.from(markers);
        },

        markerFeatures(store: Map<string, COT>, marker: string): Array<COT> {
            const feats: Set<COT> = new Set();

            for (const value of store.values()) {
                if (value.properties.group) continue;
                if (value.properties.archived) continue;

                if (value.properties.type === marker) {
                    feats.add(value);
                }
            }

            return Array.from(feats);
        },

        pathFeatures(store: Map<string, COT>, path: string): Array<COT> {
            const feats: Set<COT> = new Set();

            for (const value of store.values()) {
                if (value.path === path) {
                    feats.add(value);
                }
            }

            return Array.from(feats);
        },

        groups(store?: Map<string, COT>): Array<string> {
            if (!store) store = this.cots;

            const groups: Set<string> = new Set();
            for (const value of store.values()) {
                if (value.properties.group) groups.add(value.properties.group.name);
            }

            return Array.from(groups);
        },

        contacts(store?: Map<string, COT>, group?: string): Array<COT> {
            if (!store) store = this.cots;

            const contacts: Set<COT> = new Set();
            for (const value of store.values()) {
                if (value.properties.group) contacts.add(value);
            }

            let list = Array.from(contacts);

            if (group) {
                list = list.filter((contact) => {
                    if (!contact.properties.group) return false;
                    return contact.properties.group.name === group;
                })
            }

            return list;
        },

        async deletePath(path: string, store?: Map<string, COT>): Promise<void> {
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
        collection(store: Map<string, COT>): FeatureCollection {
            return {
                type: 'FeatureCollection',
                features: Array.from(store.values()).map((f: COT) => {
                    return f.as_rendered();
                })
            }
        },

        /**
         * Return a CoT by ID if it exists
         */
        get: function(id: string, opts?: {
            clone: boolean
        }): COT | undefined {
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

            const cot = this.cots.get(id);
            if (!cot) return;

            this.cots.delete(id);

            if (!skipNetwork && cot.properties.archived) {
                await std(`/api/profile/feature/${id}`, {
                    method: 'DELETE'
                });
            }
        },

        /**
         * Empty the store
         */
        clear: function(opts = {
            ignoreArchived: false,
            skipNetwork: false
        }): void {
            for (const feat of this.cots.values()) {
                if (opts.ignoreArchived && feat.properties.archived) continue;

                this.delete(feat.id, opts.skipNetwork);
            }
        },

        /**
         * Add a CoT GeoJSON to the store and modify props to meet MapLibre style requirements
         */
        add: async function(feat: Feature, mission_guid?: string) {
            feat = COT.style(feat);

            mission_guid = mission_guid || this.subscriptionPending.get(feat.id);

            if (mission_guid)  {
                let sub = this.subscriptions.get(mission_guid);
                if (!sub) {
                    console.error(`Cannot add ${feat.id} to mission ${mission_guid} as it is not loaded`)
                    return;
                }

                const cot = new COT(feat);
                sub.cots.set(String(cot.id), cot);

                const mapStore = useMapStore();
                mapStore.updateMissionData(mission_guid);
            } else {
                let is_mission_cot = false;
                for (const value of this.subscriptions.values()) {
                    const mission_cot = value.cots.get(feat.id);
                    if (mission_cot) {
                        mission_cot.update(feat);
                        is_mission_cot = true;
                    }
                }

                if (is_mission_cot) return;

                const exists = this.cots.get(feat.id);
                if (exists) {
                    exists.update(feat)

                    // TODO condition update depending on diff results
                    this.pending.set(String(feat.id), exists);
                } else {
                    this.pending.set(String(feat.id), new COT(feat));
                }

                if (feat.properties && feat.properties.archived) {
                    await std('/api/profile/feature', { method: 'PUT', body: feat })
                }
            }
        }
    }
})

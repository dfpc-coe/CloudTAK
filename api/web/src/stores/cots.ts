/*
* CotStore - Store & perform updates on all underlying CoT Features
*/

import COT, { OriginMode } from './base/cot.ts'
import { defineStore } from 'pinia'
import type { GeoJSONSourceDiff } from 'maplibre-gl';
import { std, stdurl } from '../std.ts';
import Subscription from './base/mission.ts';
import type { Feature, APIList } from '../types.ts';
import type { Polygon } from 'geojson';
import { booleanWithin } from '@turf/boolean-within';
import { useProfileStore } from './profile.ts';
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

        subscriptions: Map<string, Subscription>;
        subscriptionPending: Map<string, string>; // UID, Mission Guid
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
        filter: function(
            filter: (el: COT) => boolean,
            opts: {
                mission?: boolean,
            } = {}
        ): Set<COT> {
            const cots: Set<COT> = new Set();

            for (const cot of this.cots.values()) {
                if (filter(cot)) {
                    cots.add(cot);
                }
            }

            if (opts.mission) {
                for (const sub of this.subscriptions.keys()) {
                    const store = this.subscriptions.get(sub);
                    if (!store) continue;

                    for (const cot of store.cots.values()) {
                        if (filter(cot)) {
                            cots.add(cot);
                        }
                    }
                }
            }

            return cots;
        },

        subChange: async function(task: Feature): Promise<void> {
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
                    await mapStore.loadMission(updateGuid);
                }
            } else if (task.properties.type === 't-x-m-c-l' && task.properties.mission && task.properties.mission.guid) {
                const sub = this.subscriptions.get(task.properties.mission.guid);
                if (!sub) {
                    console.error(`Cannot refresh ${task.properties.mission.guid} logs as it is not subscribed`);
                    return;
                }

                await sub.updateLogs();
            } else {
                console.warn('Unknown Mission Task', JSON.stringify(task));
            }
        },

        /**
         * Return CoTs touching a given polygon
         */
        touching: function(poly: Polygon): COT[] {
            const within: COT[] = [];

            for (const cot of this.cots.values()) {
                if (booleanWithin(cot.as_feature(), poly)) {
                    within.push(cot)
                }
            }

            return within;
        },

        /**
         * Load Archived CoTs
         */
        loadArchive: async function(): Promise<void> {
            const archive = await std('/api/profile/feature') as APIList<Feature>;
            for (const a of archive.items) {
                this.add(a, undefined, {
                    skipSave: true
                });
            }
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

            const profileStore = useProfileStore();
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
                if (value.path === path && value.properties.archived) {
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
         * Return a CoT by ID if it exists
         */
        get: function(id: string, opts: {
            mission?: boolean,
        } = {
            mission: false
        }): COT | undefined {
            if (!opts) opts = {};

            let cot = this.cots.get(id);

            if (cot) {
                return cot.as_proxy();
            } else if (opts.mission) {
                for (const sub of this.subscriptions.keys()) {
                    const store = this.subscriptions.get(sub);
                    if (!store) continue;
                    cot = store.cots.get(id);

                    if (cot) {
                        return cot.as_proxy();
                    }
                }
            }

            return;
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
        add: async function(
            feat: Feature,
            mission_guid?: string,
            opts?: {
                skipSave?: boolean;
            }
        ) {
            if (!opts) opts = {};
            mission_guid = mission_guid || this.subscriptionPending.get(feat.id);

            if (mission_guid)  {
                const sub = this.subscriptions.get(mission_guid);
                if (!sub) {
                    console.error(`Cannot add ${feat.id} to mission ${mission_guid} as it is not loaded`)
                    return;
                }

                const cot = new COT(feat, {
                    mode: OriginMode.MISSION,
                    mode_id: mission_guid
                });
                sub.cots.set(String(cot.id), cot);

                const mapStore = useMapStore();
                await mapStore.loadMission(mission_guid);
            } else {
                let is_mission_cot = false;
                for (const value of this.subscriptions.values()) {
                    const mission_cot = value.cots.get(feat.id);
                    if (mission_cot) {
                        await mission_cot.update(feat);
                        is_mission_cot = true;
                    }
                }

                if (is_mission_cot) return;

                const exists = this.cots.get(feat.id);

                if (exists) {
                    exists.update(feat, { skipSave: opts.skipSave })
                } else {
                    new COT(feat);
                }
            }
        }
    }
})

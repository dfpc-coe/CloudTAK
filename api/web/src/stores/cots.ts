/*
* CotStore - Store & perform updates on all underlying CoT Features
*/

import COT from '../base/cot.ts'
import { defineStore } from 'pinia'
import { std, stdurl } from '../std.ts';
import Subscription from './base/mission.ts';
import type { Feature } from '../types.ts';
import type { Polygon } from 'geojson';
import { booleanWithin } from '@turf/boolean-within';
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
    }
})

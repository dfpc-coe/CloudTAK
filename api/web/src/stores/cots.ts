/*
* CotStore - Store & perform updates on all underlying CoT Features
*/

import COT from '../base/cot.ts'
import { defineStore } from 'pinia'
import { std, stdurl } from '../std.ts';
import Subscription from './base/mission.ts';
import type { Polygon } from 'geojson';
import { booleanWithin } from '@turf/boolean-within';

type NestedArray = {
    path: string;
    paths: Array<NestedArray>;
}

export const useCOTStore = defineStore('cots', {
    state: (): {
        cots: Map<string, COT>;

        subscriptions: Map<string, Subscription>;
        subscriptionPending: Map<string, string>; // UID, Mission Guid
    } => {
        return {
            cots: new Map(),                // Store all on-screen CoT messages
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
    }
})

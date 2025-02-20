/*
* CotStore - Store & perform updates on all underlying CoT Features
*/

import COT from '../base/cot.ts'
import { defineStore } from 'pinia'
import Subscription from './base/mission.ts';
import type { Polygon } from 'geojson';

type NestedArray = {
    path: string;
    paths: Array<NestedArray>;
}

export const useCOTStore = defineStore('cots', {
    state: (): {
        subscriptions: Map<string, Subscription>;
        subscriptionPending: Map<string, string>; // UID, Mission Guid
    } => {
        return {
            subscriptions: new Map(),       // Store All Mission CoT messages by GUID
            subscriptionPending: new Map()  // Map<uid, guid>
        }
    },
    actions: {

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

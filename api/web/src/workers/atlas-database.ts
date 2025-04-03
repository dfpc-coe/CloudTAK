/*
* ConnectionStore - Maintain the WebSocket connection with CloudTAK Server
*/

import { std } from '../std.ts';
import { LngLatBounds } from 'maplibre-gl'
import jsonata from 'jsonata';
import type Atlas from './atlas.ts';
import Subscription from '../base/subscription.ts';
import { coordEach } from '@turf/meta'
import COT, { OriginMode } from '../base/cot.ts';
import { WorkerMessageType } from '../base/events.ts';
import type { GeoJSONSourceDiff, LngLatLike } from 'maplibre-gl';
import { booleanWithin } from '@turf/boolean-within';
import type { Polygon } from 'geojson';
import type { Feature, APIList } from '../types.ts';
import type { Mission, MissionRole } from '../types.ts';

type NestedArray = {
    path: string;
    paths: Array<NestedArray>;
}

export default class AtlasDatabase {
    atlas: Atlas;

    cots: Map<string, COT>;

    hidden: Set<string>;

    // Store ImageIDs currently loaded in MapLibre
    images: Set<string>;

    pendingCreate: Map<string, COT>;
    pendingUpdate: Map<string, COT>;
    pendingHidden: Set<string>;
    pendingUnhide: Set<string>;
    pendingDelete: Set<string>;

    subscriptions: Map<string, Subscription>;
    subscriptionPending: Map<string, string>;

    constructor(atlas: Atlas) {
        this.atlas = atlas;

        this.cots = new Map();

        this.hidden = new Set();

        this.images = new Set();

        this.pendingCreate = new Map();
        this.pendingUpdate = new Map();
        this.pendingUnhide = new Set();
        this.pendingHidden = new Set();
        this.pendingDelete = new Set();

        this.subscriptions = new Map();
        this.subscriptionPending = new Map(); // UID, Mission Guid

    }

    async hide(id: string): Promise<void> {
        this.pendingHidden.add(id);
    }

    async unhide(id: string): Promise<void> {
        this.hidden.delete(id);
        this.pendingUnhide.add(id);
    }

    async hasIcon(icon: string): Promise<boolean> {
        return this.images.has(icon);
    }

    async init(): Promise<void> {
        await this.loadArchive()
    }

    async subscriptionListUid(): Promise<Set<string>> {
        return new Set(Array.from(this.subscriptions.values()).map((sub) => {
            return sub.meta.guid
        }));
    }

    async subscriptionList(): Promise<Array<{
        meta: Mission
        role: MissionRole
    }>> {

        return Array.from(this.subscriptions.values()).map((sub) => {
            return {
                meta: sub.meta,
                role: sub.role
            }
        });
    }

    async subscriptionLoad(guid: string, token?: string): Promise<Subscription> {
        const sub = await Subscription.load(this.atlas, guid, token);
        this.subscriptions.set(guid, sub);
        return sub;
    }

    async subscriptionGet(id: string): Promise<Subscription | undefined> {
        return this.subscriptions.get(id);
    }

    async subscriptionDelete(id: string): Promise<void> {
        this.subscriptions.delete(id);
    }

    updateImages(images: Array<string>): void {
        for (const image of images) {
            this.images.add(image);
        }
    }

    /**
     * Return a Set of coordinates within the given Map bounds
     * so that vertex snapping can take place when editing
     */
    async snapping(bboxarr: [number, number][]): Promise<Set<[number, number]>> {
        const bounds = new LngLatBounds(bboxarr as [LngLatLike, LngLatLike]);
        const coords = new Set<[number, number]>();

        for (const cot of this.cots.values()) {
            coordEach(cot.geometry, (coord) => {
                if (bounds.contains(coord as LngLatLike)) {
                    coords.add(coord.slice(0, 2) as [number, number]);
                }
            });
        }

        return coords;
    }

    /**
     * Generate a GeoJSONDiff on existing COT Features
     */
    async diff(): Promise<GeoJSONSourceDiff> {
        const now = +new Date();
        const diff: GeoJSONSourceDiff = {};
        diff.add = [];
        diff.remove = [];
        diff.update = [];

        const profile = await this.atlas.profile.load();
        const display_stale = profile.display_stale || 'Immediate';

        for (const cot of this.cots.values()) {
            const render = cot.as_rendered();
            const stale = new Date(cot.properties.stale).getTime();


            if (this.pendingHidden.has(String(cot.id))) {
                this.hidden.add(cot.id);
                diff.remove.push(String(cot.id))
                this.pendingHidden.delete(cot.id);
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

        for (const id of this.pendingUnhide.values()) {
            const cot = this.cots.get(id);
            if (!cot) continue;

            const render = cot.as_rendered();
            diff.add.push(render);
        }

        this.pendingUnhide.clear();

        for (const cot of this.pendingCreate.values()) {
            const render = cot.as_rendered();
            diff.add.push(render);
        }

        this.pendingCreate.clear();

        for (const cot of this.pendingUpdate.values()) {
            const render = cot.as_rendered();

            diff.update.push({
                id: String(render.id),
                addOrUpdateProperties: Object.keys(render.properties).map((key) => {
                    return { key, value: render.properties[key] }
                }),
                newGeometry: render.geometry
            })
        }

        this.pendingCreate.clear();

        for (const id of this.pendingDelete) {
            diff.remove.push(id);
            this.cots.delete(id);
        }

        this.pendingDelete.clear();

        return diff;
    }

    /**
     * Iterate over cot messages and return list of CoTs that match filter pattern
     */
    async filter(
        filter: string,
        opts: {
            limit?: number;
            mission?: boolean,
        } = {}
    ): Promise<Set<COT>> {
        const cots: Set<COT> = new Set();

        const expression = jsonata(filter);

        for (const cot of this.cots.values()) {
            if (await expression.evaluate(cot.as_feature()) === true) {
                cots.add(cot);
            }
        }

        if (opts.mission) {
            for (const sub of this.subscriptions.keys()) {
                const store = this.subscriptions.get(sub);
                if (!store) continue;

                for (const cot of store.cots.values()) {
                    if (await expression.evaluate(cot.as_feature()) === true) {
                        cots.add(cot);
                    }
                }
            }
        }

        if (opts.limit !== undefined) {
            const subset: Set<COT> = new Set();
            for (const cot of cots.values()) {
                if (subset.size === opts.limit) break;
                subset.add(cot);
            }

            return subset;
        } else {
            return cots;
        }
    }

    async filterDelete(
        filter: string,
        opts: {
            mission?: boolean,
        } = {}
    ): Promise<void> {
        const cots = await this.filter(filter, opts);

        const all = [];
        for (const cot of cots.values()) {
            all.push(this.remove(cot.id));
        }

        await Promise.allSettled(all);
    }

    async paths(store?: Map<string, COT>): Promise<Array<NestedArray>> {
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
    }

    /**
     * Return CoTs touching a given polygon
     */
    async touching(poly: Polygon): Promise<Set<COT>> {
        const within: Set<COT> = new Set();

        for (const cot of this.cots.values()) {
            if (booleanWithin(cot.as_feature(), poly)) {
                within.add(cot)
            }
        }

        return within;
    }

    /**
     * Load Archived CoTs
     */
    async loadArchive(): Promise<void> {
        const archive = await std('/api/profile/feature', {
            token: this.atlas.token
        }) as APIList<Feature>;

        for (const a of archive.items) {
            this.add(a, undefined, {
                skipSave: true,
                skipBroadcast: true
            });
        }

        this.atlas.postMessage({
            type: WorkerMessageType.Feature_Archived_Added,
        });
    }

    /**
     * Remove a given CoT from the store
     */
    async remove(id: string, skipNetwork = false): Promise<void> {
        this.pendingDelete.add(id);

        const cot = this.cots.get(id);
        if (!cot) return;

        this.cots.delete(id);

        if (cot.properties.archived) {
            this.atlas.postMessage({
                type: WorkerMessageType.Feature_Archived_Removed
            });

            if (!skipNetwork) {
                await std(`/api/profile/feature/${id}`, {
                    token: this.atlas.token,
                    method: 'DELETE'
                });
            }
        }
    }

    /**
     * Empty the store
     */
    async clear(opts = {
        ignoreArchived: false,
        skipNetwork: false
    }): Promise<void> {
        for (const feat of this.cots.values()) {
            if (opts.ignoreArchived && feat.properties.archived) continue;

            this.remove(feat.id, opts.skipNetwork);
        }
    }

    async subChange(task: Feature): Promise<void> {
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
                this.atlas.postMessage({
                    type: WorkerMessageType.Mission_Change_Feature,
                    body: {
                        guid: updateGuid
                    }
                });
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
    }

    /**
     * Add or Update a CoT GeoJSON to the store and modify props to meet MapLibre style requirements
     */
    async add(
        feat: Feature,
        mission_guid?: string,
        opts?: {
            skipSave?: boolean;
            skipBroadcast?: boolean;
        }
    ): Promise<void> {
        if (!opts) opts = {};
        mission_guid = mission_guid || this.subscriptionPending.get(feat.id);

        if (mission_guid)  {
            const sub = this.subscriptions.get(mission_guid);
            if (!sub) {
                throw new Error(`Cannot add ${feat.id} to mission ${mission_guid} as it is not loaded`)
            }

            const cot = new COT(this.atlas, feat, {
                mode: OriginMode.MISSION,
                mode_id: mission_guid
            }, opts);

            sub.cots.set(String(cot.id), cot);

            this.atlas.postMessage({
                type: WorkerMessageType.Mission_Change_Feature,
                body: {
                    guid: mission_guid
                }
            });
        } else {
            let is_mission_cot: COT | undefined;
            for (const value of this.subscriptions.values()) {
                const mission_cot = value.cots.get(feat.id);
                if (mission_cot) {
                    await mission_cot.update(feat);
                    is_mission_cot = mission_cot;
                }
            }

            if (is_mission_cot) return;

            const exists = this.cots.get(feat.id);

            if (exists) {
                exists.update({
                    properties: feat.properties,
                    geometry: feat.geometry
                }, { skipSave: opts.skipSave })
            } else {
                const cot = new COT(this.atlas, feat, {
                    mode: OriginMode.CONNECTION
                }, opts);

                if (opts.skipBroadcast !== true && cot.properties.archived) {
                    this.atlas.postMessage({
                        type: WorkerMessageType.Feature_Archived_Added,
                    });
                }
            }
        }
    }

    /**
     * Return a CoT by ID if it exists
     */
    get(id: string, opts: {
        mission?: boolean,
    } = {
        mission: false
    }): COT | undefined {
        if (!opts) opts = {};

        let cot = this.cots.get(id);

        if (cot) {
            return cot;
        } else if (opts.mission) {
            for (const sub of this.subscriptions.keys()) {
                const store = this.subscriptions.get(sub);
                if (!store) continue;
                cot = store.cots.get(id);

                if (cot) {
                    return cot;
                }
            }
        }

        return;
    }

    /**
     * Returns if the CoT is present in the store given the ID
     */
    has(id: string): boolean {
        return this.cots.has(id);
    }

    groups(store?: Map<string, COT>): Array<string> {
        if (!store) store = this.cots;

        const groups: Set<string> = new Set();
        for (const value of store.values()) {
            if (value.properties.group) groups.add(value.properties.group.name);
        }

        return Array.from(groups);
    }

    pathFeatures(path?: string, store?: Map<string, COT>): Set<COT> {
        if (!store) store = this.cots;

        const feats: Set<COT> = new Set();

        for (const value of store.values()) {
            if (path && value.path === path && value.properties.archived) {
                feats.add(value);
            } else if (!path && value.properties.archived) {
                feats.add(value);
            }
        }

        return feats;
    }

    markers(store?: Map<string, COT>): Array<string> {
        if (!store) store = this.cots;

        const markers: Set<string> = new Set();
        for (const value of store.values()) {
            if (value.properties.group) continue;
            if (value.properties.archived) continue;
            markers.add(value.properties.type);
        }

        return Array.from(markers);
    }

    markerFeatures(marker: string, store?: Map<string, COT>): Set<COT> {
        if (!store) store = this.cots;

        const feats: Set<COT> = new Set();

        for (const value of store.values()) {
            if (value.properties.group) continue;
            if (value.properties.archived) continue;

            if (value.properties.type === marker) {
                feats.add(value);
            }
        }

        return feats;
    }

    contacts(group?: string, store?: Map<string, COT>): Set<COT> {
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

        return new Set(list);
    }
}

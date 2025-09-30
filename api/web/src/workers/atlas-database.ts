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
import type { InputFeature, Feature, APIList } from '../types.ts';
import type { Mission, MissionRole } from '../types.ts';

type NestedArray = {
    path: string;
    paths: Array<NestedArray>;
}

export default class AtlasDatabase {
    atlas: Atlas;

    cots: Map<string, COT>;

    // Stores Active Mission if present
    mission?: Subscription;

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

    async makeActiveMission(guid? : string): Promise<void> {
        if (guid) {
            this.mission = await this.subscriptionGet(guid);
        } else {
            this.mission = undefined;
        }
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

    /**
     * Return a list of Subscription GUIDs
     * @param opts - Options
     * @param opts.dirty - If true return only subscriptions that have changed
     */
    async subscriptionListUid(opts?: {
        dirty: boolean
    }): Promise<Set<string>> {
        if (!opts) opts = { dirty: false };

        return new Set(Array.from(this.subscriptions.values())
            .filter((sub) => {
                if (!opts.dirty) return true;
                return sub._dirty;
            })
           .map((sub) => {
                return sub.meta.guid
            }));
    }

    async subscriptionClean(guid: string): Promise<boolean> {
        const sub = this.subscriptions.get(guid);
        if (!sub) return false;

        sub._dirty = false;

        return true;
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

    async subscriptionGet(
        id: string,
        opts: {
            refresh?: boolean
        } = {}
     ): Promise<Subscription | undefined> {
        const sub = this.subscriptions.get(id);

        if (!sub) return;

        if (opts.refresh) {
            await sub.refresh();
        }

        return sub;
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
                const min = coord.slice(0, 2) as [number, number];

                // Don't Send Invalid Coords
                if (min[0] < -180 || min[0] > 180 || min[1] < -90 || min[1] > 90) {
                    return;
                }

                if (bounds.contains({ lng: min[0], lat: min[1] })) {
                    coords.add(min);
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
                diff.remove.push(cot.vectorId())
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
                diff.remove.push(cot.vectorId())
            } else if (!cot.properties.archived) {
                if (now < stale && (cot.properties['icon-opacity'] !== 1 || cot.properties['marker-opacity'] !== 1)) {
                    cot.properties['icon-opacity'] = 1;
                    cot.properties['marker-opacity'] = 1;

                    if (!['Point', 'Polygon', 'LineString'].includes(cot.geometry.type)) continue;

                    diff.update.push({
                        id: Number(render.id),
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
                        id: Number(render.id),
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
                id: Number(render.id),
                addOrUpdateProperties: Object.keys(render.properties).map((key) => {
                    return { key, value: render.properties[key] }
                }),
                newGeometry: render.geometry
            })
        }

        this.pendingCreate.clear();

        for (const id of this.pendingDelete) {
            const cot = this.get(id);
            if (!cot) continue;

            diff.remove.push(cot.vectorId());

            this.cots.delete(id);
        }

        this.pendingDelete.clear();

        return diff;
    }

    /**
     * Iterate over all CoTs and delete toTs that match the filter pattern
     * @param filter - JSONata filter expression to match CoTs against
     */
    async filterRemove(
        filter: string,
        opts: {
            mission?: boolean,
            skipNetwork?: boolean
        } = {}
    ): Promise<void> {
        const cots = await this.filter(filter, opts);

        const all = [];
        for (const cot of cots.values()) {
            all.push(this.remove(cot.id, {
                mission: opts.mission || false,
                skipNetwork: opts.skipNetwork
            }));
        }

        await Promise.allSettled(all);
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
            all.push(this.remove(cot.id, {
                mission: opts.mission || false
            }));
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
     *
     * @param poly - GeoJSON Polygon to test CoTs against
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
            this.add(a, {
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
     *
     * @param id - UID of the CoT to remove
     * @param opts - Options
     * @param opts.mission      - If true, search Mission Stores for the CoT
     * @param opts.skipNetwork  - If an archived CoT, don't delete from the server
     */
    async remove(
        id: string,
        opts: {
            mission?: boolean,
            skipNetwork?: boolean
        } = {
            mission: false,
            skipNetwork: false
        }
    ): Promise<void> {
        const cot = this.get(id, {
            mission: opts.mission
        });

        // TODO Throw an error?
        if (!cot) {
            console.warn(`Cannot remove CoT ${id} as it does not exist in the store`);
            return;
        }

        if (cot.origin.mode === OriginMode.CONNECTION) {
            this.pendingDelete.add(id);

            if (cot.properties.archived) {
                this.atlas.postMessage({
                    type: WorkerMessageType.Feature_Archived_Removed
                });

                if (!opts.skipNetwork) {
                    await std(`/api/profile/feature/${id}`, {
                        token: this.atlas.token,
                        method: 'DELETE'
                    });
                }
            }
        } else if (cot.origin.mode === OriginMode.MISSION && cot.origin.mode_id) {
            const subscription = await this.subscriptionGet(cot.origin.mode_id);
            if (!subscription) throw new Error('Could not delete as Mission Subscription does not exist');

            await subscription.deleteFeature(cot.id, {
                skipNetwork: opts.skipNetwork
            });
        }
    }

    /**
     * Empty the store
     *
     * @param opts - Options
     * @param opts.ignoreArchived   - Don't delete archived features
     * @param opts.skipNetwork      - Don't delete archived features from the server
     */
    async clear(opts = {
        ignoreArchived: false,
        skipNetwork: false
    }): Promise<void> {
        for (const feat of this.cots.values()) {
            if (opts.ignoreArchived && feat.properties.archived) {
                continue;
            }

            this.remove(feat.id, {
                skipNetwork: opts.skipNetwork
            });
        }
    }

    /**
     * Called everytime a Mission Task message is received
     *
     * @param task - GeoJSON Feature representing the Mission Task
     */
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

                    await sub.deleteFeature(change.contentUid, {
                        // This is critical to ensure a recursive loop of doesn't occur
                        skipNetwork: true
                    });

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
     *
     * @param feat - GeoJSON Feature to create/update in Store
     *
     * @param opts - Optional Options
     * @param opts.skipSave - Don't save the COT to the Profile Feature Database
     * @param opts.skipBroadcast - Don't broadcast the COT on the internal message bus to the UI
     * @param opts.authored - If the COT is authored, append creator information if the CoT is new & potentially add it to a mission
     */
    async add(
        feature: InputFeature,
        opts?: {
            skipSave?: boolean;
            skipBroadcast?: boolean;
            authored?: boolean,
        }
    ): Promise<COT> {
        if (!opts) opts = {};

        feature.properties.id = feature.id;

        const feat = feature as Feature;

        // Check if CoT exists
        let exists = this.get(feat.properties.id, {
            mission: true
        });

        if (opts.authored && !exists) {
            feat.properties.creator = await this.atlas.profile.creator();
        }

        // New CoT destined for a Mission
        if (
            !exists && (
                (this.mission && opts.authored) // Authored CoT and we have an active Mission
                || (
                    feat.origin && feat.origin.mode === "Mission"
                    && feat.origin.mode_id
                )
                || this.subscriptionPending.get(feat.id)
            )
            || exists && (
                exists.origin.mode === OriginMode.MISSION
                && exists.origin.mode_id
            )
        ) {
            const pendingGuid = this.subscriptionPending.get(feat.id);
            this.subscriptionPending.delete(feat.id);

            const mission_guid =
                this.mission?.meta.guid // An Active Mission
                || pendingGuid
                || feat.origin?.mode_id; // The feature has a Mission Origin

            if (!mission_guid) {
                throw new Error(`Cannot add ${feat.id} to a mission as no mission GUID was found - Please report this error`);
            }

            const sub = this.subscriptions.get(mission_guid);

            if (!sub) {
                throw new Error(`Cannot add ${feat.id} to mission ${mission_guid} as it is not loaded`)
            }

            if (!exists) {
                exists = new COT(this.atlas, feat, {
                    mode: OriginMode.MISSION,
                    mode_id: mission_guid
                }, opts);
            } else {
                exists.update({
                    path: feat.path,
                    properties: feat.properties,
                    geometry: feat.geometry
                }, { skipSave: opts.skipSave })
            }

            await sub.updateFeature(exists, {
                skipNetwork: !opts.authored
            });

            this.atlas.postMessage({
                type: WorkerMessageType.Mission_Change_Feature,
                body: {
                    guid: mission_guid
                }
            });

            return exists;
        } else {
            if (exists) {
                exists.update({
                    path: feat.path,
                    properties: feat.properties,
                    geometry: feat.geometry
                }, { skipSave: opts.skipSave })
            } else {
                exists = new COT(this.atlas, feat, {
                    mode: OriginMode.CONNECTION
                }, opts);

                if (opts.skipBroadcast !== true && exists.properties.archived) {
                    this.atlas.postMessage({
                        type: WorkerMessageType.Feature_Archived_Added,
                    });
                }
            }

            if (exists.is_skittle) {
                await this.atlas.team.set(exists);
            }

            return exists;
        }
    }

    /**
     * Return a CoT by ID if it exists
     *
     * @param id - ID of the CoT to return
     * @param opts - Options
     * @param opts.mission - If true, search Mission Stores for the CoT
     */
    get(
        id: string,
        opts: {
            mission?: boolean,
        } = {
            mission: false
        }
    ): COT | undefined {
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

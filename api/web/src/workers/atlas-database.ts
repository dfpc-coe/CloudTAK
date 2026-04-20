
/*
* AtlasConnection - Maintain the WebSocket connection with CloudTAK Server
*/

import { std } from '../std.ts';
import { db } from '../base/database.ts';
import type { DBSubscriptionChanges } from '../base/database.ts';
import { LngLatBounds } from 'maplibre-gl'
import jsonata from 'jsonata';
import type Atlas from './atlas.ts';
import Subscription from '../base/subscription.ts';
import { coordEach } from '@turf/meta'
import COT, { OriginMode } from '../base/cot.ts';
import ContactManager from '../base/contact.ts';
import TAKNotification, { NotificationType } from '../base/notification.ts';
import { WorkerMessageType } from '../base/events.ts';
import type { GeoJSONSourceDiff, LngLatLike } from 'maplibre-gl';
import { booleanWithin } from '@turf/boolean-within';
import type { Polygon } from 'geojson';
import type { InputFeature, Feature, APIList, Contact } from '../types.ts';
import ProfileConfig from '../base/profile.ts';
import * as Comlink from 'comlink';
import AtlasBreadcrumb from './atlas-breadcrumb.ts';

type NestedArray = {
    path: string;
    count: number;
    paths: Array<NestedArray>;
}

export default class AtlasDatabase {
    atlas: Atlas;

    cots: Map<string, COT>;

    // Stores Active Mission if present
    mission?: string;

    static normalizePath(path: string): string {
        if (!path) return '/';
        if (!path.startsWith('/')) path = '/' + path;
        path = path.replace(/\/+/g, '/');
        if (path !== '/' && path.endsWith('/')) path = path.slice(0, -1);
        return path;
    }

    pendingCreate: Map<string, COT>;
    pendingUpdate: Map<string, COT>;
    pendingHidden: Set<string>;
    pendingUnhide: Set<string>;
    pendingDelete: Set<string>;

    subscriptionPending: Map<string, string>;

    breadcrumb: AtlasBreadcrumb & Comlink.ProxyMarked;

    constructor(atlas: Atlas) {
        this.atlas = atlas;

        this.cots = new Map();

        this.pendingCreate = new Map();
        this.pendingUpdate = new Map();
        this.pendingUnhide = new Set();
        this.pendingHidden = new Set();
        this.pendingDelete = new Set();

        this.subscriptionPending = new Map(); // UID, Mission Guid

        this.breadcrumb = Comlink.proxy(new AtlasBreadcrumb(this));
    }

    async makeActiveMission(guid? : string): Promise<void> {
        if (guid) {
            this.mission = guid;
        } else {
            this.mission = undefined;
        }
    }

    /**
     * Only Called by non-Mission CoTs, caller is responsible for creating Filters
     */
    async hide(id: string): Promise<void> {
        this.pendingHidden.add(id);
    }

    /**
     * Only Called by non-Mission CoTs, caller is responsible for removing Filters
     */
    async unhide(id: string): Promise<void> {
        this.pendingUnhide.add(id);
    }

    async init(): Promise<void> {
        COT.selfUid = this.atlas.profile.uid();
        try {
            await this.loadArchive();
        } catch (err) {
            console.error('Failed to load archived features:', err);
        }
        await this.breadcrumb.load();
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
        const staleDelete = new Set<string>();

        const display_stale = (await ProfileConfig.get('display_stale'))?.value || 'Immediate';

        for (const cot of this.cots.values()) {
            const stale = new Date(cot.properties.stale).getTime();

            if (this.pendingHidden.has(String(cot.id))) {
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
                staleDelete.add(cot.id);
            } else if (!cot.properties.archived) {
                if (now < stale && (cot.properties['icon-opacity'] !== 1 || cot.properties['marker-opacity'] !== 1)) {
                    cot.properties['icon-opacity'] = 1;
                    cot.properties['marker-opacity'] = 1;

                    if (!['Point', 'Polygon', 'LineString'].includes(cot.geometry.type)) continue;

                    const fresh = cot.as_rendered();
                    diff.update.push({
                        id: Number(fresh.id),
                        addOrUpdateProperties: Object.keys(fresh.properties).map((key) => {
                            return { key, value: fresh.properties ? fresh.properties[key] : '' }
                        }),
                        newGeometry: fresh.geometry
                    })
                } else if (now > stale && (cot.properties['icon-opacity'] !== 0.5 || cot.properties['marker-opacity'] !== 0.5)) {
                    cot.properties['icon-opacity'] = 0.5;
                    cot.properties['marker-opacity'] = 0.5;

                    if (!['Point', 'Polygon', 'LineString'].includes(cot.geometry.type)) continue;

                    const dimmed = cot.as_rendered();
                    diff.update.push({
                        id: Number(dimmed.id),
                        addOrUpdateProperties: Object.keys(dimmed.properties).map((key) => {
                            return { key, value: dimmed.properties ? dimmed.properties[key] : '' }
                        }),
                        newGeometry: dimmed.geometry
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
            if (staleDelete.has(cot.id) || this.pendingDelete.has(cot.id)) continue;
            const render = cot.as_rendered();
            diff.add.push(render);
        }

        this.pendingCreate.clear();

        for (const cot of this.pendingUpdate.values()) {
            if (staleDelete.has(cot.id) || this.pendingDelete.has(cot.id)) continue;

            const render = cot.as_rendered();

            diff.update.push({
                id: Number(render.id),
                addOrUpdateProperties: Object.keys(render.properties).map((key) => {
                    return { key, value: render.properties[key] }
                }),
                newGeometry: render.geometry
            })
        }

        this.pendingUpdate.clear();

        for (const id of staleDelete) {
            this.cots.delete(id);
            await db.feature.delete(id);
        }

        for (const id of this.pendingDelete) {
            const cot = await this.get(id);
            if (!cot) continue;

            diff.remove.push(cot.vectorId());

            this.cots.delete(id);
            await db.feature.delete(id);
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
            for (const sub of await Subscription.localList({
                subscribed: true
            })) {
                const store = await Subscription.from(sub.guid, this.atlas.token, {
                    subscribed: true
                });

                if (!store) continue;

                for (const feat of await store.feature.list()) {
                    if (await expression.evaluate(feat) === true) {
                        cots.add(await COT.load(feat, {
                            mode: OriginMode.MISSION,
                            mode_id: sub.guid
                        }));
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

        const paths = new Map<string, number>();
        for (const value of store.values()) {
            if (value.path && value.path !== '/' && value.properties.archived) {
                const normalized = AtlasDatabase.normalizePath(value.path);
                if (normalized === '/') continue;
                paths.set(normalized, (paths.get(normalized) || 0) + 1);
            }
        }

        return Array.from(paths.keys()).map((path) => {
            return {
                path: path,
                count: paths.get(path) || 0,
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
        const cot = await this.get(id, {
            mission: opts.mission
        });

        // TODO Throw an error?
        if (!cot) {
            console.warn(`Cannot remove CoT ${id} as it does not exist in the store`);
            return;
        }

        const breadcrumbUid = cot.properties.breadcrumb
            ? String(cot.properties.uid || cot.id).replace(/\.track$/, '')
            : cot.id;
        const breadcrumbId = `${breadcrumbUid}.track`;
        const breadcrumbEntry = await db.breadcrumb.get(breadcrumbId);

        if (breadcrumbEntry) {
            await this.breadcrumb.remove(breadcrumbUid);

            if (this.cots.has(breadcrumbId)) {
                this.pendingDelete.add(breadcrumbId);
            }

            await db.feature.delete(breadcrumbId);
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
            const subscription = await Subscription.from(cot.origin.mode_id, this.atlas.token, {
                subscribed: true
            });

            if (!subscription) throw new Error('Could not delete as Mission Subscription does not exist');

            await subscription.feature.delete(this.atlas, cot.id, {
                skipNetwork: opts.skipNetwork
            });

            this.atlas.postMessage({
                type: WorkerMessageType.Mission_Change_Feature,
                body: {
                    guid: cot.origin.mode_id
                }
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
            let doMissionRefresh = false;

            for (const change of task.properties.mission.missionChanges) {
                if (!task.properties.mission.guid) {
                    console.error(`Cannot add ${change.contentUid} to ${JSON.stringify(task.properties.mission)} as no guid was included`);
                    continue;
                }

                await db.subscription_changes.put({
                    serverTime: new Date().toISOString(),
                    ...change,
                    mission: task.properties.mission.guid,
                } as DBSubscriptionChanges);

                if (change.contentResource) {
                    doMissionRefresh = true;
                }

                if (change.type === 'ADD_CONTENT') {
                    if (change.contentUid) this.subscriptionPending.set(change.contentUid, task.properties.mission.guid);
                } else if (change.type === 'REMOVE_CONTENT') {
                    const sub = await Subscription.from(task.properties.mission.guid, this.atlas.token, {
                        subscribed: true
                    });
                    if (!sub) {
                        console.error(`Cannot remove ${change.contentUid} from ${task.properties.mission.guid} as it's not in memory`);
                        continue;
                    }

                    if (!change.contentUid) continue;

                    await sub.feature.delete(this.atlas, change.contentUid, {
                        // This is critical to ensure a recursive loop of doesn't occur
                        skipNetwork: true
                    });

                    updateGuid = task.properties.mission.guid;
                }
            }

            if (doMissionRefresh && task.properties.mission.guid) {
                const sub = await Subscription.from(task.properties.mission.guid, this.atlas.token, {
                    subscribed: true
                });

                if (sub) {
                    await sub.fetch();
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
            const sub = await Subscription.from(task.properties.mission.guid, this.atlas.token, {
                subscribed: true
            });

            if (!sub) {
                console.error(`Cannot refresh ${task.properties.mission.guid} logs as it is not subscribed`);
                return;
            }

            await sub.log.refresh();
        } else if (task.properties.type === 't-x-m-c-m' && task.properties.mission && task.properties.mission.guid) {
            const sub = await Subscription.from(task.properties.mission.guid, this.atlas.token, {
                subscribed: true
            });

            if (!sub) {
                console.error(`Cannot refresh ${task.properties.mission.guid} logs as it is not subscribed`);
                return;
            }

            await sub.fetch();
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
    ): Promise<COT | void> {
        if (!opts) opts = {};

        feature.properties.id = feature.id;

        const feat = feature as Feature;

        // Check if CoT exists
        let exists = await this.get(feat.properties.id, {
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
                this.mission // An Active Mission
                || pendingGuid
                || feat.origin?.mode_id; // The feature has a Mission Origin

            if (!mission_guid) {
                throw new Error(`Cannot add ${feat.id} to a mission as no mission GUID was found - Please report this error`);
            }

            const sub = await Subscription.from(mission_guid, this.atlas.token, {
                subscribed: true
            });

            if (!sub) {
                throw new Error(`Cannot add ${feat.id} to mission ${mission_guid} as it is not loaded`)
            }

            if (!exists) {
                exists = await COT.load(feat, {
                    mode: OriginMode.MISSION,
                    mode_id: mission_guid
                }, opts);
            } else {
                await exists.update({
                    path: feat.path,
                    properties: feat.properties,
                    geometry: feat.geometry
                }, { skipSave: opts.skipSave })
            }

            await sub.feature.update(this.atlas, exists, {
                skipNetwork: !opts.authored
            });

            this.atlas.postMessage({
                type: WorkerMessageType.Mission_Change_Feature,
                body: {
                    guid: mission_guid
                }
            });

            await this.breadcrumb.update(exists);

            return exists;
        } else {
            if (exists) {
                await exists.update({
                    path: feat.path,
                    properties: feat.properties,
                    geometry: feat.geometry
                }, { skipSave: opts.skipSave })

                this.pendingUpdate.set(exists.id, exists);

                // Sync profile if this is the user's own COT
                if (exists.is_self) {
                    const remarks = this.atlas.profile.profile_remarks?.value;
                    const callsign = this.atlas.profile.profile_callsign?.value;

                    if (
                        (remarks !== undefined && exists.properties.remarks !== remarks)
                        || (callsign !== undefined && exists.properties.callsign !== callsign)
                    ) {
                        await this.atlas.profile.update({
                            tak_callsign: exists.properties.callsign,
                            tak_remarks: exists.properties.remarks
                        });
                    }
                }
            } else {
                // Don't add already-stale CoTs to the map
                if (!feat.properties.archived) {
                    const display_stale = (await ProfileConfig.get('display_stale'))?.value || 'Immediate';
                    const stale = new Date(feat.properties.stale).getTime();
                    const now = Date.now();

                    if (
                        !['Never'].includes(display_stale)
                        && (
                            display_stale === 'Immediate'       && now > stale
                            || display_stale === '10 Minutes'   && now > stale + 600000
                            || display_stale === '30 Minutes'   && now > stale + 600000 * 3
                            || display_stale === '1 Hour'       && now > stale + 600000 * 6
                        )
                    ) {
                        return;
                    }
                }

                exists = await COT.load(feat, {
                    mode: OriginMode.CONNECTION
                }, opts);

                this.pendingCreate.set(exists.id, exists);
                this.cots.set(exists.id, exists);

                await db.feature.put({
                    id: exists.id,
                    path: exists.path,
                    properties: exists.properties,
                    geometry: exists.geometry
                });

                if (opts.skipBroadcast !== true && exists.properties.archived) {
                    this.atlas.postMessage({
                        type: WorkerMessageType.Feature_Archived_Added,
                    });
                }
            }

            if (exists.is_skittle) {
                if (!exists.properties.group) {
                    throw new Error('Contact Marker must have group property');
                }

                const entry = await ContactManager.get(exists.id);

                if (!entry) {
                    const contact: Contact = {
                        uid: exists.id,
                        notes: '',
                        filterGroups: null,
                        callsign: exists.properties.callsign,
                        team: exists.properties.group.name,
                        role: exists.properties.group.role,
                        takv: ''
                    }

                    await ContactManager.put(contact);

                    if (this.atlas.profile.uid() !== exists.id) {
                        await TAKNotification.create(
                            NotificationType.Contact,
                            'Online Contact',
                            `${exists.properties.callsign} is now Online`,
                            `/cot/${exists.id}`,
                            false
                        );
                    }
                }
            }

            await this.breadcrumb.update(exists);

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
    async get(
        id: string,
        opts: {
            mission?: boolean,
        } = {
            mission: false
        }
    ): Promise<COT | undefined> {
        if (!id) throw new Error('Cannot get marker without an ID');

        if (!opts) opts = {};

        let cot = this.cots.get(id);

        if (cot) {
            return cot;
        } else if (opts.mission) {
            for (const sub of await Subscription.localList({
                subscribed: true
            })) {
                const store = await Subscription.from(sub.guid, this.atlas.token, {
                    subscribed: true
                });

                if (!store) continue;

                const feat = await store.feature.from(id);

                if (!feat) continue;

                cot = await COT.load(feat, {
                    mode: OriginMode.MISSION,
                    mode_id: sub.guid
                });

                return cot;
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

        const normalizedPath = path ? AtlasDatabase.normalizePath(path) : undefined;
        const feats: Set<COT> = new Set();

        for (const value of store.values()) {
            if (normalizedPath && value.properties.archived) {
                const valuePath = AtlasDatabase.normalizePath(value.path);
                if (valuePath === normalizedPath) feats.add(value);
            } else if (!normalizedPath && value.properties.archived) {
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

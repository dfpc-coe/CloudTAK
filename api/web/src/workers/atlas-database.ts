/*
* ConnectionStore - Maintain the WebSocket connection with CloudTAK Server
*/

import { std, stdurl } from '../std.ts';
import COT from '../base/cot.ts';
import { WorkerMessage } from '../base/events.ts';
import { expose } from 'comlink';
import type { GeoJSONSourceDiff } from 'maplibre-gl';
import AtlasProfile from './atlas-profile.ts';
import type { Feature } from '../types.ts';

export class AtlasDatabase {
    atlas: Atlas;

    cots: Map<string, COT>;
    hidden: Set<string>;

    // Store ImageIDs currently loaded in MapLibre
    images: Set<string>;

    pending: Map<string, COT>;
    pendingDelete: Set<string>;

    subscriptions: Map<string, Subscription>;
    subscriptionPending: Map<string, string>;

    constructor(atlas: Atlas) {
        this.cots = new Map();
        this.hidden = new Set();

        this.images = new Set();

        this.pending = new Map();
        this.pendingDelete = new Set();

        this.subscriptions = new Map();
        this.subscriptionPending = new Map(); // UID, Mission Guid

    }

    /**
     * Generate a GeoJSONDiff on existing COT Features
     */
    diff(): GeoJSONSourceDiff {
        const now = +new Date();
        const diff: GeoJSONSourceDiff = {};
        diff.add = [];
        diff.remove = [];
        diff.update = [];

        // TODO
        //const profileStore = useProfileStore();
        //const display_stale = profileStore.profile ? profileStore.profile.display_stale : 'Immediate';
        const display_stale = 'Immediate';

        for (const cot of purse.cots.values()) {
            const render = cot.as_rendered();
            const stale = new Date(cot.properties.stale).getTime();

            if (purse.hidden.has(String(cot.id))) {
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

        for (const cot of purse.pending.values()) {
            const render = cot.as_rendered();

            if (purse.cots.has(cot.id)) {
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

            purse.cots.set(cot.id, cot);
        }

        purse.pending.clear();

        for (const id of purse.pendingDelete) {
            diff.remove.push(id);
            purse.cots.delete(id);
        }

        purse.pendingDelete.clear();

        return diff;
    }

    /**
     * Load Archived CoTs
     */
    async loadArchive(): Promise<void> {
        const archive = await std('/api/profile/feature', { token: purse.token }) as APIList<Feature>;
        for (const a of archive.items) {
            add(a, undefined, {
                skipSave: true
            });
        }
    }

    /**
     * Remove a given CoT from the store
     */
    async remove(id: string, skipNetwork = false): Promise<void> {
        purse.pendingDelete.add(id);

        const cot = purse.cots.get(id);
        if (!cot) return;

        purse.cots.delete(id);

        if (!skipNetwork && cot.properties.archived) {
            await std(`/api/profile/feature/${id}`, {
                method: 'DELETE'
            });
        }
    }

    /**
     * Empty the store
     */
    clear(opts = {
        ignoreArchived: false,
        skipNetwork: false
    }): void {
        for (const feat of purse.cots.values()) {
            if (opts.ignoreArchived && feat.properties.archived) continue;

            delete(feat.id, opts.skipNetwork);
        }
    }

    /**
     * Add a CoT GeoJSON to the store and modify props to meet MapLibre style requirements
     */
    async add(
        feat: Feature,
        mission_guid?: string,
        opts?: {
            skipSave?: boolean;
        }
    ): Promise<void> {
        if (!opts) opts = {};
        mission_guid = mission_guid || purse.subscriptionPending.get(feat.id);

        if (mission_guid)  {
            const sub = purse.subscriptions.get(mission_guid);
            if (!sub) {
                throw new Error(`Cannot add ${feat.id} to mission ${mission_guid} as it is not loaded`)
            }

            const cot = new COT(purse, feat, {
                mode: OriginMode.MISSION,
                mode_id: mission_guid
            });

            sub.cots.set(String(cot.id), cot);

            const mapStore = useMapStore();
            await mapStore.loadMission(mission_guid);
        } else {
            let is_mission_cot: COT | undefined;
            for (const value of purse.subscriptions.values()) {
                const mission_cot = value.cots.get(feat.id);
                if (mission_cot) {
                    await mission_cot.update(feat);
                    is_mission_cot = mission_cot;
                }
            }

            if (is_mission_cot) return;

            const exists = purse.cots.get(feat.id);

            if (exists) {
                exists.update(feat, { skipSave: opts.skipSave })
            } else {
                new COT(purse, feat);
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
    }): Feature | undefined {
        if (!opts) opts = {};

        let cot = purse.cots.get(id);

        if (cot) {
            return cot.as_feature();
        } else if (opts.mission) {
            for (const sub of purse.subscriptions.keys()) {
                const store = purse.subscriptions.get(sub);
                if (!store) continue;
                cot = store.cots.get(id);

                if (cot) {
                    return cot.as_feature();
                }
            }
        }

        return;
    }

    /**
     * Returns if the CoT is present in the store given the ID
     */
    has(id: string): boolean {
        return purse.cots.has(id);
    }

    destroy() {
        purse.isDestroyed = true;

        if (purse.ws) {
            purse.ws.close();
        }
    }
}

import { db } from '../database.ts';
import type Subscription from './subscription.ts';
import { server } from '../std.ts';
import type {
    MissionLayer,
    MissionLayerList,
    MissionLayer_Create,
    MissionLayer_Update
} from '../types.ts';

/**
 * Apply a mutation to every stored layer for a mission, recursing into nested
 * layers, and persist the result so liveQuery observers update.
 *
 * Module-scoped rather than a native #private method - class instances are
 * held in Vue refs, and reactive proxies cannot access #private members.
 */
async function updateLocalLayers(
    mission: string,
    fn: (layer: MissionLayer) => void
): Promise<void> {
    const walk = (layer: MissionLayer): void => {
        fn(layer);

        for (const child of layer.mission_layers || []) {
            walk(child as MissionLayer);
        }
    };

    await db.transaction('rw', db.subscription_layer, async () => {
        const rows = await db.subscription_layer
            .where('mission')
            .equals(mission)
            .toArray();

        for (const row of rows) {
            walk(row.layer);
            await db.subscription_layer.put(row);
        }
    });
}

/**
 * High Level Wrapper around the Data/Mission Sync Layer API
 *
 * Layers are hydrated from the server and persisted in the local Dexie
 * `subscription_layer` table so that they can be observed reactively via
 * liveQuery.
 */
export default class SubscriptionLayer {
    parent: Subscription;

    token: string;
    missiontoken?: string;

    constructor(
        parent: Subscription,
        opts: {
            token: string,
            missiontoken?: string,
        }
    ) {
        this.parent = parent;

        this.token = opts.token;
        this.missiontoken = opts.missiontoken;
    }

    headers(): Record<string, string> {
        const headers: Record<string, string> = {};
        if (this.missiontoken) headers.MissionAuthorization = this.missiontoken;
        return headers;
    }

    /**
     * Hard refresh the mission layers from the server and persist them
     * in the local Dexie store.
     */
    async refresh(): Promise<void> {
        const { data, error } = await server.GET('/api/marti/missions/{:name}/layer', {
            params: {
                path: { ':name': this.parent.guid }
            },
            headers: this.headers()
        });

        if (error || !data) throw new Error('Failed to fetch mission layers');

        const list = data as unknown as MissionLayerList;

        list.data.sort((a, b) => {
            return (a.name ?? '').localeCompare(b.name ?? '');
        });

        await db.transaction('rw', db.subscription_layer, async () => {
            await db.subscription_layer
                .where('mission')
                .equals(this.parent.guid)
                .delete();

            for (const layer of list.data) {
                await db.subscription_layer.put({
                    uid: layer.uid,
                    mission: this.parent.guid,
                    layer
                });
            }
        });
    }

    /**
     * List the mission layers from the local store.
     *
     * @param opts - Options for listing the layers
     * @param opts.refresh - If true, refresh from the server before listing
     */
    async list(
        opts?: {
            refresh?: boolean,
        }
    ): Promise<Array<MissionLayer>> {
        if (opts?.refresh) {
            await this.refresh();
        }

        const layers = await db.subscription_layer
            .where('mission')
            .equals(this.parent.guid)
            .toArray();

        return layers
            .map((l) => l.layer)
            .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
    }

    /**
     * Create a new mission layer, then refresh the local store.
     */
    async create(
        layer: MissionLayer_Create
    ): Promise<MissionLayer> {
        const { data, error } = await server.POST('/api/marti/missions/{:name}/layer', {
            params: {
                path: { ':name': this.parent.guid }
            },
            headers: this.headers(),
            body: layer
        });

        if (error || !data) throw new Error('Failed to create mission layer');

        await this.refresh();

        return data as unknown as MissionLayer;
    }

    /**
     * Update an existing mission layer, then refresh the local store.
     */
    async update(
        layerid: string,
        layer: MissionLayer_Update
    ): Promise<MissionLayer> {
        const { data, error } = await server.PATCH('/api/marti/missions/{:name}/layer/{:uid}', {
            params: {
                path: { ':name': this.parent.guid, ':uid': layerid }
            },
            headers: this.headers(),
            body: layer
        });

        if (error || !data) throw new Error('Failed to update mission layer');

        await this.refresh();

        return data as unknown as MissionLayer;
    }

    /**
     * File existing mission features under a mission layer, moving them from
     * any layer they are currently filed under.
     *
     * The move is applied to the local store first so the UI updates
     * immediately - TAK Server layer listings can lag behind mutations, so the
     * local store is authoritative until the next full refresh. On API failure
     * the local store is re-synced from the server.
     */
    async attachFeatures(
        layeruid: string,
        uids: string[]
    ): Promise<void> {
        const timestamp = new Date().toISOString();

        await updateLocalLayers(this.parent.guid, (layer) => {
            if (layer.uids) {
                layer.uids = layer.uids.filter((u) => !uids.includes(u.data));
            }

            if (layer.uid === layeruid) {
                layer.uids = (layer.uids || []).concat(uids.map((data) => ({
                    data,
                    timestamp,
                    creatorUid: ''
                })));
            }
        });

        const { error } = await server.PUT('/api/marti/missions/{:name}/layer/{:uid}/cot', {
            params: {
                path: { ':name': this.parent.guid, ':uid': layeruid }
            },
            headers: this.headers(),
            body: { uids }
        });

        if (error) {
            await this.refresh();
            throw new Error('Failed to move features into mission layer');
        }
    }

    /**
     * Move a mission feature out of a mission layer and back to the mission
     * root - the feature remains part of the mission.
     *
     * The move is applied to the local store first so the UI updates
     * immediately. On API failure the local store is re-synced from the server.
     */
    async detachFeature(
        layeruid: string,
        uid: string
    ): Promise<void> {
        await updateLocalLayers(this.parent.guid, (layer) => {
            if (layer.uid === layeruid && layer.uids) {
                layer.uids = layer.uids.filter((u) => u.data !== uid);
            }
        });

        const { error } = await server.DELETE('/api/marti/missions/{:name}/layer/{:uid}/cot/{:cotuid}', {
            params: {
                path: { ':name': this.parent.guid, ':uid': layeruid, ':cotuid': uid }
            },
            headers: this.headers()
        });

        if (error) {
            await this.refresh();
            throw new Error('Failed to move feature out of mission layer');
        }
    }

    /**
     * Delete a mission layer, then refresh the local store.
     */
    async delete(
        layeruid: string
    ): Promise<void> {
        const { error, response } = await server.DELETE('/api/marti/missions/{:name}/layer/{:uid}', {
            params: {
                path: { ':name': this.parent.guid, ':uid': layeruid }
            },
            headers: this.headers()
        });

        if (error && response.status !== 404) throw new Error('Failed to delete mission layer');

        await this.refresh();
    }
}

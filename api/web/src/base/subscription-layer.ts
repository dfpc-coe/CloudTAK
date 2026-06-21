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
            // Consistent sort by name
            return a.name.localeCompare(b.name);
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
            .sort((a, b) => a.name.localeCompare(b.name));
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

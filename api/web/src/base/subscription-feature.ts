import { db } from './database.ts';
import type { Atlas } from '../worker/atlas.ts';
import { std, stdurl } from '../std.ts';
import { bbox } from '@turf/bbox';
import type { BBox } from 'geojson'
import type { Feature, FeatureCollection } from '../types.ts';

/**
 * High Level Wrapper around the Data/Mission Sync API
 */
export default class SubscriptionFeature {
    guid: string;

    token: string;
    missiontoken?: string;

    constructor(
        guid: string,
        opts: {
            token: string,
            missiontoken?: string,
        }
    ) {
        this.token = opts.token;
        this.missiontoken = opts.token;

        this.guid = guid;
    }

    headers(): Record<string, string> {
        const headers: Record<string, string> = {};
        if (this.missiontoken) headers.MissionAuthorization = this.missiontoken;
        return headers;
    }

    async refresh(): Promise<void> {
        const url = stdurl('/api/marti/missions/' + encodeURIComponent(this.guid) + '/cot');

        const list = await std(url, {
            method: 'GET',
            token: this.token,
            headers: this.headers()
        }) as FeatureCollection;

        await db.transaction('rw', db.subscription_feature, async () => {
            await db.subscription_feature
                .where('mission')
                .equals(this.guid)
                .delete();

            for (const feature of list.features) {
                await db.subscription_feature.put({
                    id: feature.id,
                    mission: this.guid,
                    path: feature.path,
                    properties: feature.properties,
                    geometry: feature.geometry,
                });
            }
        });
    }

    async list(
        opts?: {
            filter?: string,
            refresh: false,
        }
    ): Promise<Array<Feature>> {
        if (opts?.refresh) {
            await this.refresh();
        }

        const feats = await db.subscription_feature
            .where("mission")
            .equals(this.guid)
            .toArray();

        return feats.map(f => ({
            id: f.id,
            type: 'Feature',
            path: f.path,
            properties: f.properties,
            geometry: f.geometry,
        }));
    }

    async bounds(): Promise<BBox> {
        return bbox({
            type: 'FeatureCollection',
            features: await this.list()
        });
    }

    async from(
        id: string
    ): Promise<Feature | undefined> {
        const f = await db.subscription_feature
            .where("id")
            .equals(id)
            .first();

        if (!f) return;

        return {
            id: f.id,
            type: 'Feature',
            path: f.path,
            properties: f.properties,
            geometry: f.geometry,
        }
    }

    /**
     * Upsert a feature into the mission.
     * This will udpate the feature in the local DB, submit it to the TAK Server and
     * mark the subscription as dirty for a re-render
     *
     * @param atlas - The Atlas instance
     * @param cot - The COT object to upsert
     * @param opts - Options for updating the feature
     * @param opts.skipNetwork - If true, the feature will not be updated on the server - IE in response to a Mission Change event
     */
    async update(
        atlas: Atlas,
        cot: COT,
        opts: {
            skipNetwork?: boolean
        } = {}
    ): Promise<void> {
        this.cots.set(String(cot.id), cot);

        this.dirty = true;

        const feat = cot.as_feature({
            clone: true
        });

        feat.properties.dest = [{
            mission: this.name
        }];

        if (!opts.skipNetwork) {
            await atlas.conn.sendCOT(feat);
        }
    }

    /**
     * Delete a feature from the mission.
     *
     * @param atlas - The Atlas instance
     * @param uid - The unique ID of the feature to delete
     * @param opts - Options for deleting the feature
     * @param opts.skipNetwork - If true, the feature will not be deleted from the server - IE in response to a Mission Change event
     */
    async delete(
        atlas: Atlas,
        uid: string,
        opts: {
            skipNetwork?: boolean
        } = {}
    ): Promise<void> {
        this.cots.delete(uid);

        this.dirty = true;

        if (!opts.skipNetwork) {
            const url = stdurl(`/api/marti/missions/${this.guid}/cot/${uid}`);
            await std(url, {
                method: 'DELETE',
                headers: this.headers(this.missiontoken),
                token:  atlas.token
            })
        }
    }
}

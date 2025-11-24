import { db } from './database.ts';
import Filter from './filter.ts';
import COT from './cot.ts';
import Subscription from './subscription.ts';
import type Atlas from '../workers/atlas.ts';
import { std, stdurl } from '../std.ts';
import { bbox } from '@turf/bbox';
import type { BBox, FeatureCollection as GeoJSONFeatureCollection } from 'geojson'
import type { Feature, FeatureCollection } from '../types.ts';

/**
 * High Level Wrapper around the Data/Mission Sync API
 */
export default class SubscriptionFeature {
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

    async refresh(): Promise<void> {
        const url = stdurl('/api/marti/missions/' + encodeURIComponent(this.parent.guid) + '/cot');

        const list = await std(url, {
            method: 'GET',
            token: this.token,
            headers: this.headers()
        }) as FeatureCollection;

        for (const feat of list.features) {
            await COT.style(feat);
        }

        await db.transaction('rw', db.subscription_feature, async () => {
            await db.subscription_feature
                .where('mission')
                .equals(this.parent.guid)
                .delete();

            for (const feature of list.features) {
                await db.subscription_feature.put({
                    id: feature.id,
                    mission: this.parent.guid,
                    path: feature.path,
                    properties: feature.properties,
                    geometry: feature.geometry,
                });
            }
        });
    }

    async list(
        opts?: {
            refresh: false,
        }
    ): Promise<Array<Feature>> {
        if (opts?.refresh) {
            await this.refresh();
        }

        const feats = await db.subscription_feature
            .where("mission")
            .equals(this.parent.guid)
            .toArray();

        return feats.map(f => ({
            id: f.id,
            type: 'Feature',
            path: f.path,
            properties: f.properties,
            geometry: f.geometry,
        }));
    }

    async collection(raw = true): Promise<FeatureCollection> {
        const features = await this.list();

        if (raw) {
            return {
                type: 'FeatureCollection',
                features: features.map((feat) => {
                    return feat
                })
            } as FeatureCollection;
        } else {
            const filters = await Filter.list();
            const filtered: Feature[] = [];

            for (const feat of features) {
                let blocked = false;
                for (const filter of filters) {
                    if (await filter.test(feat)) {
                        blocked = true;
                        break;
                    }
                }

                if (!blocked) filtered.push(feat);
            }

            return {
                type: 'FeatureCollection',
                features: filtered
            } as FeatureCollection;
        }
    }

    async bounds(): Promise<BBox> {
        return bbox(await this.collection() as GeoJSONFeatureCollection);
    }

    async from(
        uid: string
    ): Promise<Feature | undefined> {
        const f = await db.subscription_feature
            .where("[mission+id]")
            .equals([this.parent.guid, uid])
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
        await db.subscription_feature.put({
            id: cot.id,
            mission: this.parent.guid,
            path: cot.path,
            properties: cot.properties,
            geometry: cot.geometry,
        });

        await this.parent.update({
            dirty: true
        })

        const feat = cot.as_feature({
            clone: true
        });

        feat.properties.dest = [{
            'mission-guid': this.parent.guid
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
        await db.subscription_feature
            .where("[mission+id]")
            .equals([this.parent.guid, uid])
            .delete();

        await this.parent.update({
            dirty: true
        })

        if (!opts.skipNetwork) {
            const url = stdurl(`/api/marti/missions/${this.parent.guid}/cot/${uid}`);
            await std(url, {
                method: 'DELETE',
                headers: this.headers(),
                token:  atlas.token
            })
        }
    }
}

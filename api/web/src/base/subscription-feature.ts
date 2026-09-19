import { db, ChatStatus } from '../database.ts';
import type { DBSubscriptionFeature } from '../database.ts';
import { isEqual } from '@ver0/deep-equal';
import Filter from './filter.ts';
import COT, { renderedIcon } from './cot.ts';
import Subscription from './subscription.ts';
import type Atlas from '../workers/atlas.ts';
import { server } from '../std.ts';
import { bbox } from '@turf/bbox';
import type { BBox, FeatureCollection as GeoJSONFeatureCollection } from 'geojson'
import type { Feature, FeatureCollection } from '../types.ts';
import type { paths } from '@cloudtak/api-types';
import { WorkerMessageType } from '../utils/events.ts';

type SubmitFeature = paths["/api/marti/missions/{:guid}/cot"]["put"]["requestBody"]["content"]["application/json"]["features"][number];

// Matches the feature cap on PUT /api/marti/missions/:guid/cot
const PUSH_BATCH = 100;

const pushing = new Map<string, { promise: Promise<boolean>, again: boolean }>();

function asFeature(row: DBSubscriptionFeature): Feature {
    return {
        id: row.id,
        type: 'Feature',
        path: row.path,
        properties: row.properties,
        geometry: row.geometry,
    };
}

function isPending(row: DBSubscriptionFeature): boolean {
    return row.synced === false || row.deleted === true;
}

function eventTime(properties: Feature["properties"]): number {
    const time = new Date(String(properties.time || '')).getTime();
    return Number.isNaN(time) ? 0 : time;
}

/**
 * An unconfirmed local change is only replaced by a strictly newer server copy
 */
function localWins(row: DBSubscriptionFeature | undefined, incoming: Feature["properties"]): boolean {
    if (!row) return false;
    if (row.deleted) return true;
    if (row.synced !== false) return false;
    return eventTime(incoming) <= eventTime(row.properties);
}

/**
 * High Level Wrapper around the Data/Mission Sync API
 */
export default class SubscriptionFeature {
    parent: Subscription;

    missiontoken?: string;

    constructor(
        parent: Subscription,
        opts: {
            missiontoken?: string,
        }
    ) {
        this.parent = parent;

        this.missiontoken = opts.missiontoken;
    }

    headers(): Record<string, string> {
        const headers: Record<string, string> = {};
        if (this.missiontoken) headers.MissionAuthorization = this.missiontoken;
        return headers;
    }

    async refresh(): Promise<void> {
        const channel = new BroadcastChannel('cloudtak');
        try {
            const { data, error } = await server.GET('/api/marti/missions/{:guid}/cot', {
                params: { path: { ':guid': this.parent.guid } },
                headers: this.headers()
            });

            if (error || !data) throw new Error('Failed to fetch mission features');

            const list = data as unknown as FeatureCollection;

            for (const feat of list.features) {
                await COT.style(feat);
            }

            const mapFeatures = list.features.filter((f) => f.properties.type !== 'b-t-f');
            const chatFeatures = list.features.filter((f) => f.properties.type === 'b-t-f');

            await db.transaction('rw', db.subscription_feature, db.subscription_chat, async () => {
                const pending = new Map<string, DBSubscriptionFeature>();
                for (const row of await this.pending()) {
                    pending.set(row.id, row);
                }

                await db.subscription_feature
                    .where('mission')
                    .equals(this.parent.guid)
                    .filter((f) => !isPending(f))
                    .delete();

                const remote = new Set<string>();

                for (const feature of mapFeatures) {
                    remote.add(feature.id);

                    if (localWins(pending.get(feature.id), feature.properties)) continue;

                    await db.subscription_feature.put({
                        id: feature.id,
                        mission: this.parent.guid,
                        path: feature.path,
                        properties: feature.properties,
                        geometry: feature.geometry,
                        synced: true,
                        deleted: false,
                        attempts: 0,
                    });
                }

                // The server no longer has the feature so there is nothing left to delete
                for (const row of pending.values()) {
                    if (row.deleted && !remote.has(row.id)) {
                        await db.subscription_feature.delete(row.id);
                    }
                }

                const unreadChats = new Set(
                    await db.subscription_chat
                        .where('mission')
                        .equals(this.parent.guid)
                        .filter(c => c.unread === true)
                        .primaryKeys()
                );

                await db.subscription_chat
                    .where('mission')
                    .equals(this.parent.guid)
                    .delete();

                for (const feature of chatFeatures) {
                    const chat = feature.properties.chat as {
                        chatroom: string;
                        id: string;
                        senderCallsign: string;
                        messageId?: string;
                        chatgrp?: { _attributes?: { uid0?: string } };
                    } | undefined;
                    if (!chat) continue;

                    // Key on the messageId so a message sent locally (stored under its
                    // messageId) is replaced by the server copy rather than duplicated
                    const id = chat.messageId || feature.id;

                    await db.subscription_chat.put({
                        id,
                        mission: this.parent.guid,
                        chatroom: chat.chatroom,
                        sender: chat.senderCallsign || String(feature.properties.callsign || ''),
                        sender_uid: chat.chatgrp?._attributes?.uid0 || chat.id,
                        message: String(feature.properties.remarks || ''),
                        created: String(feature.properties.start || feature.properties.time || new Date().toISOString()),
                        unread: unreadChats.has(id),
                        // The message came back from the Mission so it has reached the server
                        status: ChatStatus.Sent,
                    });
                }
            });

            channel.postMessage({
                type: WorkerMessageType.Mission_Change_Feature,
                body: {
                    guid: this.parent.guid
                }
            });
        } finally {
            channel.close();
        }
    }

    async list(
        opts?: {
            refresh?: boolean,
        }
    ): Promise<Array<Feature>> {
        if (opts?.refresh) {
            await this.refresh();
        }

        const feats = await db.subscription_feature
            .where("mission")
            .equals(this.parent.guid)
            .filter((f) => !f.deleted)
            .toArray();

        return feats.map(asFeature);
    }

    /**
     * Local changes that have not been confirmed by the server, including tombstones
     */
    async pending(): Promise<Array<DBSubscriptionFeature>> {
        return await db.subscription_feature
            .where("mission")
            .equals(this.parent.guid)
            .filter(isPending)
            .toArray();
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

                if (!blocked) {
                    const icon = renderedIcon(feat.properties);

                    filtered.push({
                        ...feat,
                        properties: {
                            ...feat.properties,
                            path: feat.path || '/',
                            ...(icon !== undefined ? { icon } : {})
                        }
                    });
                }
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

        if (!f || f.deleted) return;

        return asFeature(f);
    }

    /**
     * Upsert a feature into the mission.
     * This will update the feature in the local DB, mark the subscription as dirty for a re-render
     * and submit it to the TAK Server in the background, leaving it unsynced until confirmed
     *
     * @param opts.skipNetwork - If true, the feature came from the server - IE in response to a Mission Change event
     */
    async update(
        atlas: Atlas,
        cot: COT,
        opts: {
            skipNetwork?: boolean
        } = {}
    ): Promise<void> {
        const isChat = cot.properties.type === 'b-t-f';

        if (isChat) {
            const chat = cot.properties.chat as {
                chatroom: string;
                id: string;
                senderCallsign: string;
                messageId?: string;
                chatgrp?: { _attributes?: { uid0?: string } };
            } | undefined;

            if (chat) {
                await db.subscription_chat.put({
                    id: chat.messageId || cot.id,
                    mission: this.parent.guid,
                    chatroom: chat.chatroom,
                    sender: chat.senderCallsign || String(cot.properties.callsign || ''),
                    sender_uid: chat.chatgrp?._attributes?.uid0 || chat.id,
                    message: String(cot.properties.remarks || ''),
                    created: String(cot.properties.start || cot.properties.time || new Date().toISOString()),
                    unread: !!opts.skipNetwork,
                    // The message arrived via the Mission so it has reached the server
                    status: ChatStatus.Sent,
                });
            }
        } else if (opts.skipNetwork) {
            await db.transaction('rw', db.subscription_feature, async () => {
                const row = await db.subscription_feature.get(cot.id);
                if (row && row.mission === this.parent.guid && localWins(row, cot.properties)) return;

                await db.subscription_feature.put({
                    id: cot.id,
                    mission: this.parent.guid,
                    path: cot.path,
                    properties: cot.properties,
                    geometry: cot.geometry,
                    synced: true,
                    deleted: false,
                    attempts: 0,
                });
            });
        } else {
            // Edits otherwise keep the original event time, which would make them
            // indistinguishable from an older copy echoed back by the server
            cot.properties.time = new Date().toISOString();

            await db.subscription_feature.put({
                id: cot.id,
                mission: this.parent.guid,
                path: cot.path,
                properties: cot.properties,
                geometry: cot.geometry,
                synced: false,
                deleted: false,
                attempts: 0,
            });
        }

        await this.parent.update({
            dirty: true
        })

        if (opts.skipNetwork) return;

        if (isChat) {
            const feat = cot.as_feature({
                clone: true
            });

            feat.properties.dest = [{
                mission: this.parent.name
            }];

            await atlas.conn.sendCOT(feat);
        } else {
            void this.push();
        }
    }

    /**
     * Delete a feature from the mission.
     * A local delete leaves a tombstone until the TAK Server confirms it
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
        const rows = db.subscription_feature
            .where("[mission+id]")
            .equals([this.parent.guid, uid]);

        if (opts.skipNetwork) {
            // An unconfirmed local edit outlives a server delete and is resubmitted
            await rows.filter((f) => f.synced !== false || f.deleted === true).delete();
        } else {
            await rows.modify({
                synced: false,
                deleted: true,
                attempts: 0,
                error: undefined,
            });
        }

        await this.parent.update({
            dirty: true
        })

        if (!opts.skipNetwork) void this.push();
    }

    /**
     * Submit unconfirmed local changes to the TAK Server, never rejecting - failures are
     * recorded on the rows. Concurrent calls for a mission share a single in-flight push
     *
     * @returns true if every pending change was confirmed
     */
    async push(): Promise<boolean> {
        const guid = this.parent.guid;

        const running = pushing.get(guid);
        if (running) {
            running.again = true;
            return running.promise;
        }

        const state = { again: false, promise: Promise.resolve(true) };

        state.promise = (async () => {
            try {
                let ok = true;

                do {
                    state.again = false;
                    ok = await this.flush();
                } while (ok && state.again);

                return ok;
            } catch (err) {
                console.error(`Failed to push Mission ${guid} features`, err);
                return false;
            } finally {
                pushing.delete(guid);
            }
        })();

        pushing.set(guid, state);

        return state.promise;
    }

    private async flush(): Promise<boolean> {
        const pending = await this.pending();
        const upserts = pending.filter((row) => !row.deleted);
        const removes = pending.filter((row) => row.deleted);

        let ok = true;

        for (let i = 0; i < upserts.length; i += PUSH_BATCH) {
            const batch = upserts.slice(i, i + PUSH_BATCH);

            try {
                const { error } = await server.PUT('/api/marti/missions/{:guid}/cot', {
                    params: { path: { ':guid': this.parent.guid } },
                    headers: this.headers(),
                    body: { features: batch.map(asFeature) as SubmitFeature[] }
                });

                if (error) throw new Error(error.message);

                await this.confirm(batch);
            } catch (err) {
                ok = false;
                await this.failed(batch, err);
            }
        }

        for (const row of removes) {
            try {
                const { error, response } = await server.DELETE('/api/marti/missions/{:guid}/cot/{:uid}', {
                    params: { path: { ':guid': this.parent.guid, ':uid': row.id } },
                    headers: this.headers(),
                });

                // Already gone from the server is the outcome the tombstone wanted
                if (error && response.status !== 404) throw new Error(error.message);

                await db.transaction('rw', db.subscription_feature, async () => {
                    const current = await db.subscription_feature.get(row.id);
                    if (current && current.mission === this.parent.guid && current.deleted) {
                        await db.subscription_feature.delete(row.id);
                    }
                });
            } catch (err) {
                ok = false;
                await this.failed([row], err);
            }
        }

        return ok;
    }

    /**
     * Mark rows as synced unless they were changed again while the request was in flight
     */
    private async confirm(sent: Array<DBSubscriptionFeature>): Promise<void> {
        await db.transaction('rw', db.subscription_feature, async () => {
            for (const row of sent) {
                const current = await db.subscription_feature.get(row.id);

                if (
                    !current
                    || current.mission !== this.parent.guid
                    || current.deleted
                    || !isEqual(asFeature(current), asFeature(row))
                ) continue;

                await db.subscription_feature.update(row.id, {
                    synced: true,
                    attempts: 0,
                    error: undefined,
                });
            }
        });
    }

    private async failed(rows: Array<DBSubscriptionFeature>, err: unknown): Promise<void> {
        const error = err instanceof Error ? err.message : String(err);

        await db.transaction('rw', db.subscription_feature, async () => {
            for (const row of rows) {
                const current = await db.subscription_feature.get(row.id);
                if (!current || current.mission !== this.parent.guid || !isPending(current)) continue;

                await db.subscription_feature.update(row.id, {
                    attempts: current.attempts + 1,
                    error,
                });
            }
        });
    }
}

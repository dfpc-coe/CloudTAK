import xmljs from 'xml-js';
import TAKAPI from '../tak-api.js';
import { CoT } from '@tak-ps/node-tak';
import { Type, Static } from '@sinclair/typebox';
import Err from '@openaddresses/batch-error';
import { Readable } from 'node:stream'
import { TAKItem, TAKList } from './types.js';
import { MissionLog } from './mission-log.js';
import type { Feature } from '@tak-ps/node-cot';

export enum MissionSubscriberRole {
    MISSION_OWNER = 'MISSION_OWNER',
    MISSION_SUBSCRIBER = 'MISSION_SUBSCRIBER',
    MISSION_READONLY_SUBSCRIBER = 'MISSION_READONLY_SUBSCRIBER'
}

export const MissionContent = Type.Object({
    keywords: Type.Array(Type.String()),
    mimeType: Type.String(),
    name: Type.String(),
    hash: Type.String(),
    submissionTime: Type.String(),
    submitter: Type.String(),
    uid: Type.String(),
    creatorUid: Type.String(),
    size: Type.Integer(),
    expiration: Type.Integer()
});

export const Mission = Type.Object({
    name: Type.String(),
    description: Type.String(),
    chatRoom: Type.String(),
    baseLayer: Type.Optional(Type.String()),
    bbox: Type.Optional(Type.String()),
    path: Type.Optional(Type.String()),
    classification: Type.Optional(Type.String()),
    tool: Type.String(),
    keywords: Type.Array(Type.Unknown()),
    creatorUid: Type.String(),
    createTime: Type.String(),
    externalData: Type.Array(Type.Unknown()),
    feeds: Type.Array(Type.Unknown()),
    mapLayers: Type.Array(Type.Unknown()),
    ownerRole: Type.Optional(Type.Object({
        permissions: Type.Array(Type.String()),
        type: Type.Enum(MissionSubscriberRole)
    })),
    inviteOnly: Type.Boolean(),
    expiration: Type.Number(),
    guid: Type.String(),
    uids: Type.Array(Type.Unknown()),
    logs: Type.Optional(Type.Array(MissionLog)),                // Only present if ?logs=true
    contents: Type.Array(Type.Object({
        timestamp: Type.String(),
        creatorUid: Type.String(),
        data: MissionContent
    })),
    passwordProtected: Type.Boolean(),
    token: Type.Optional(Type.String()),                        // Only present when mission created
    groups: Type.Optional(Type.Union([Type.String(), Type.Array(Type.String())])),           // Only present on Mission.get()
    missionChanges: Type.Optional(Type.Array(Type.Unknown()))   // Only present on Mission.get()
});

export const MissionChange = Type.Object({
    isFederatedChange: Type.Boolean(),
    type: Type.String(),
    missionName: Type.String(),
    timestamp: Type.String(),
    serverTime: Type.String(),
    creatorUid: Type.String(),
    contentUid: Type.Optional(Type.String()),
    details: Type.Optional(Type.Object({
        type: Type.String(),
        callsign: Type.String(),
        color: Type.Optional(Type.String()),
        location: Type.Object({
            lat: Type.Number(),
            lon: Type.Number()
        })
    })),
    contentResource: Type.Optional(MissionContent)
});

export const MissionRole = Type.Object({
    permissions: Type.Array(Type.String()),
    hibernateLazyInitializer: Type.Optional(Type.Any()),
    type: Type.Enum(MissionSubscriberRole)
})

export const MissionSubscriber = Type.Object({
    token: Type.Optional(Type.String()),
    clientUid: Type.String(),
    username: Type.String(),
    createTime: Type.String(),
    role: MissionRole
})

export const MissionOptions = Type.Object({
    token: Type.Optional(Type.String())
});

export const AttachContentsInput = Type.Object({
    hashes: Type.Optional(Type.Array(Type.String())),
    uids: Type.Optional(Type.Array(Type.String())),
});

export const DetachContentsInput = Type.Object({
    hash: Type.Optional(Type.String()),
    uid: Type.Optional(Type.String())
});

export const MissionChangesInput = Type.Object({
    secago: Type.Optional(Type.Integer()),
    start: Type.Optional(Type.String()),
    end: Type.Optional(Type.String()),
    squashed: Type.Optional(Type.Boolean())
})

export const SubscribedInput = Type.Object({
    uid: Type.String(),
})

export const UnsubscribeInput = Type.Object({
    uid: Type.String(),
    disconnectOnly: Type.Optional(Type.Boolean())
})

export const SubscriptionInput = Type.Object({
    uid: Type.String(),
});

export const SubscribeInput = Type.Object({
    uid: Type.String(),
    password: Type.Optional(Type.String()),
    secago: Type.Optional(Type.Integer()),
    start: Type.Optional(Type.String()),
    end: Type.Optional(Type.String())
})

export const MissionDeleteInput = Type.Object({
    creatorUid: Type.Optional(Type.String()),
    deepDelete: Type.Optional(Type.Boolean())
})

export const GetInput = Type.Object({
    password: Type.Optional(Type.String()),
    changes: Type.Optional(Type.Boolean()),
    logs: Type.Optional(Type.Boolean()),
    secago: Type.Optional(Type.Integer()),
    start: Type.Optional(Type.String()),
    end: Type.Optional(Type.String())
});

export const SetRoleInput = Type.Object({
    clientUid: Type.String(),
    username: Type.String(),
    role: MissionRole
});

export const MissionListInput = Type.Object({
    passwordProtected: Type.Optional(Type.Boolean()),
    defaultRole: Type.Optional(Type.Boolean()),
    tool: Type.Optional(Type.String())
});

export const MissionCreateInput = Type.Object({
    group: Type.Optional(Type.Union([Type.Array(Type.String()), Type.String()])),
    creatorUid: Type.String(),
    description: Type.Optional(Type.String({ default: '' })),
    chatRoom: Type.Optional(Type.String()),
    baseLayer: Type.Optional(Type.String()),
    bbox: Type.Optional(Type.String()),
    boundingPolygon: Type.Optional(Type.Array(Type.String())),
    path: Type.Optional(Type.String()),
    classification: Type.Optional(Type.String()),
    tool: Type.Optional(Type.String({ default: 'public' })),
    password: Type.Optional(Type.String()),
    defaultRole: Type.Optional(Type.String()),
    expiration: Type.Optional(Type.Integer()),
    inviteOnly: Type.Optional(Type.Boolean({ default: false })),
    allowDupe: Type.Optional(Type.Boolean({ default: false })),
});

export const GUIDMatch = new RegExp(/^[{]?[0-9a-fA-F]{8}-([0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}[}]?$/);

export const TAKList_Mission = TAKList(Mission);
export const TAKList_MissionChange = TAKList(MissionChange);
export const TAKList_MissionSubscriber = TAKList(MissionSubscriber);
export const TAKItem_MissionSubscriber = TAKItem(MissionSubscriber);

/**
 * @class
 */
export default class {
    api: TAKAPI;

    constructor(api: TAKAPI) {
        this.api = api;
    }

    #isGUID(id: string): boolean {
        return GUIDMatch.test(id)
    }

    #encodeName(name: string): string {
        return encodeURIComponent(name.trim())
    }

    #headers(opts?: Static<typeof MissionOptions>): object {
        if (opts && opts.token) {
            return {
                MissionAuthorization: `Bearer ${opts.token}`
            }
        } else {
            return {};
        }
    }

    /**
     * Return Mission Sync changes in a given time range
     *
     * {@link https://docs.tak.gov/api/takserver/redoc#tag/mission-api/operation/getMissionChanges TAK Server Docs}.
     */
    async changes(
        name: string,
        query: Static<typeof MissionChangesInput>,
        opts?: Static<typeof MissionOptions>
    ): Promise<Static<typeof TAKList_MissionChange>> {
        if (this.#isGUID(name)) name = (await this.getGuid(name, {})).name;

        const url = new URL(`/Marti/api/missions/${this.#encodeName(name)}/changes`, this.api.url);

        let q: keyof Static<typeof MissionChangesInput>;
        for (q in query) {
            if (query[q] !== undefined) {
                url.searchParams.append(q, String(query[q]));
            }
        }

        const changes = await this.api.fetch(url, {
            method: 'GET',
            headers: this.#headers(opts),
        });

        return changes;
    }

    /**
     * Return all current features in the Data Sync as CoT GeoJSON Features
     */
    async latestFeats(
        name: string,
        opts?: Static<typeof MissionOptions>
    ): Promise<Static<typeof Feature.Feature>[]> {
        const feats: Static<typeof Feature.Feature>[] = [];

        const res: any = xmljs.xml2js(await this.latestCots(name, opts), { compact: true });

        if (!Object.keys(res.events).length) return feats;
        if (!res.events.event || (Array.isArray(res.events.event) && !res.events.event.length)) return feats;

        for (const event of Array.isArray(res.events.event) ? res.events.event : [res.events.event] ) {
            feats.push((new CoT({ event })).to_geojson());
        }

        return feats;
    }

    /**
     * Return all current features in the Data Sync as CoT GeoJSON Features
     *
     * {@link https://docs.tak.gov/api/takserver/redoc#tag/mission-api/operation/getLatestMissionCotEvents TAK Server Docs}.
     */
    async latestCots(
        name: string,
        opts?: Static<typeof MissionOptions>
    ): Promise<string> {
        const url = this.#isGUID(name)
            ? new URL(`/Marti/api/missions/guid/${encodeURIComponent(name)}/cot`, this.api.url)
            : new URL(`/Marti/api/missions/${this.#encodeName(name)}/cot`, this.api.url);

        return await this.api.fetch(url, {
            method: 'GET',
            headers: this.#headers(opts)
        });
    }

    /**
     * Return users associated with this mission
     *
     * {@link https://docs.tak.gov/api/takserver/redoc#tag/mission-api/operation/getMissionContacts TAK Server Docs}.
     */
    async contacts(
        name: string,
        opts?: Static<typeof MissionOptions>
    ) {
        const url = this.#isGUID(name)
            ? new URL(`/Marti/api/missions/guid/${encodeURIComponent(name)}/contacts`, this.api.url)
            : new URL(`/Marti/api/missions/${this.#encodeName(name)}/contacts`, this.api.url);

        return await this.api.fetch(url, {
            method: 'GET',
            headers: this.#headers(opts)
        });
    }

    /**
     * Remove a file from the mission
     *
     * {@link https://docs.tak.gov/api/takserver/redoc#tag/mission-api/operation/removeMissionContent TAK Server Docs}.
     */
    async detachContents(
        name: string,
        body: Static<typeof DetachContentsInput>,
        opts?: Static<typeof MissionOptions>
    ) {
        const url = this.#isGUID(name)
            ? new URL(`/Marti/api/missions/guid/${encodeURIComponent(name)}/contents`, this.api.url)
            : new URL(`/Marti/api/missions/${this.#encodeName(name)}/contents`, this.api.url);

        if (body.hash) url.searchParams.append('hash', body.hash);
        if (body.uid) url.searchParams.append('uid', body.uid);

        return await this.api.fetch(url, {
            method: 'DELETE',
            headers: this.#headers(opts),
        });
    }

    /**
     * Attach a file resource by hash from the TAK Server file manager
     *
     * {@link https://docs.tak.gov/api/takserver/redoc#tag/mission-api/operation/addMissionContent TAK Server Docs}.
     */
    async attachContents(
        name: string,
        body: Static<typeof AttachContentsInput>,
        opts?: Static<typeof MissionOptions>
    ) {
        const url = this.#isGUID(name)
            ? new URL(`/Marti/api/missions/guid/${encodeURIComponent(name)}/contents`, this.api.url)
            : new URL(`/Marti/api/missions/${this.#encodeName(name)}/contents`, this.api.url);

        return await this.api.fetch(url, {
            method: 'PUT',
            headers: this.#headers(opts),
            body
        });
    }

    /**
     * Upload a Mission Package
     *
     * {@link https://docs.tak.gov/api/takserver/redoc#tag/mission-api/operation/addMissionPackage TAK Server Docs}.
     */
    async upload(
        name: string,
        creatorUid: string,
        body: Readable,
        opts?: Static<typeof MissionOptions>
    ) {
        if (this.#isGUID(name)) name = (await this.getGuid(name, {})).name;

        const url = new URL(`/Marti/api/missions/${this.#encodeName(name)}/contents/missionpackage`, this.api.url);
        url.searchParams.append('creatorUid', creatorUid);

        return await this.api.fetch(url, {
            method: 'PUT',
            headers: this.#headers(opts),
            body
        });
    }

    /**
     * Return UIDs associated with any subscribed users
     *
     * {@link https://docs.tak.gov/api/takserver/redoc#tag/mission-api/operation/getMissionSubscriptions TAK Server Docs}.
     */
    async subscriptions(
        name: string,
        opts?: Static<typeof MissionOptions>
    ): Promise<Static<typeof TAKItem_MissionSubscriber>> {
        const url = this.#isGUID(name)
            ? new URL(`/Marti/api/missions/guid/${encodeURIComponent(name)}/subscriptions`, this.api.url)
            : new URL(`/Marti/api/missions/${this.#encodeName(name)}/subscriptions`, this.api.url);

        return await this.api.fetch(url, {
            method: 'GET',
            headers: this.#headers(opts),
        });
    }

    /**
     * Return permissions associated with any subscribed users
     *
     * {@link https://docs.tak.gov/api/takserver/redoc#tag/mission-api/operation/getMissionSubscriptionRoles TAK Server Docs}.
     */
    async subscriptionRoles(
        name: string,
        opts?: Static<typeof MissionOptions>
    ): Promise<Static<typeof TAKList_MissionSubscriber>> {
        const url = this.#isGUID(name)
            ? new URL(`/Marti/api/missions/guid/${encodeURIComponent(name)}/subscriptions/roles`, this.api.url)
            : new URL(`/Marti/api/missions/${this.#encodeName(name)}/subscriptions/roles`, this.api.url);

        return await this.api.fetch(url, {
            method: 'GET',
            headers: this.#headers(opts),
        });
    }

    /**
     * Return Role associated with a given mission if subscribed
     *
     * {@link https://docs.tak.gov/api/takserver/redoc#tag/mission-api/operation/setMissionRole TAK Server Docs}.
     */
    async setRole(
        name: string,
        query: Static<typeof SetRoleInput>,
        opts?: Static<typeof MissionOptions>
    ): Promise<Static<typeof MissionRole>> {
        const url = this.#isGUID(name)
            ? new URL(`/Marti/api/missions/guid/${encodeURIComponent(name)}/role`, this.api.url)
            : new URL(`/Marti/api/missions/${this.#encodeName(name)}/role`, this.api.url);

        let q: keyof Static<typeof SetRoleInput>;
        for (q in query) {
            if (query[q] !== undefined) {
                url.searchParams.append(q, String(query[q]));
            }
        }

        const res = await this.api.fetch(url, {
            method: 'PUT',
            headers: this.#headers(opts),
        });

        return res.data;
    }

    /**
     * Return Role associated with a given mission if subscribed
     *
     * {@link https://docs.tak.gov/api/takserver/redoc#tag/mission-api/operation/getMissionRoleFromToken TAK Server Docs}.
     */
    async role(
        name: string,
        opts?: Static<typeof MissionOptions>
    ): Promise<Static<typeof MissionRole>> {
        const url = this.#isGUID(name)
            ? new URL(`/Marti/api/missions/guid/${encodeURIComponent(name)}/role`, this.api.url)
            : new URL(`/Marti/api/missions/${this.#encodeName(name)}/role`, this.api.url);

        const res = await this.api.fetch(url, {
            method: 'GET',
            headers: this.#headers(opts),
        });

        return res.data;
    }

    /**
     * Return subscription associated with a given mission if subscribed
     *
     * {@link https://docs.tak.gov/api/takserver/redoc#tag/mission-api/operation/getSubscriptionForUser TAK Server Docs}.
     */
    async subscription(
        name: string,
        query: Static<typeof SubscriptionInput>,
        opts?: Static<typeof MissionOptions>
    ): Promise<Static<typeof MissionSubscriber>> {
        const url = this.#isGUID(name)
            ? new URL(`/Marti/api/missions/guid/${encodeURIComponent(name)}/subscription`, this.api.url)
            : new URL(`/Marti/api/missions/${this.#encodeName(name)}/subscription`, this.api.url);

        let q: keyof Static<typeof SubscriptionInput>;
        for (q in query) {
            if (query[q] !== undefined) {
                url.searchParams.append(q, String(query[q]));
            }
        }

        const res = await this.api.fetch(url, {
            method: 'GET',
            headers: this.#headers(opts),
        });

        return res.data;
    }

    /**
     * Subscribe to a mission
     *
     * {@link https://docs.tak.gov/api/takserver/redoc#tag/mission-api/operation/createMissionSubscription TAK Server Docs}.
     */
    async subscribe(
        name: string,
        query: Static<typeof SubscribeInput>,
        opts?: Static<typeof MissionOptions>
    ): Promise<Static<typeof TAKItem_MissionSubscriber>> {
        const url = this.#isGUID(name)
            ? new URL(`/Marti/api/missions/guid/${encodeURIComponent(name)}/subscription`, this.api.url)
            : new URL(`/Marti/api/missions/${this.#encodeName(name)}/subscription`, this.api.url);

        let q: keyof Static<typeof SubscribeInput>;
        for (q in query) {
            if (query[q] !== undefined) {
                url.searchParams.append(q, String(query[q]));
            }
        }

        return await this.api.fetch(url, {
            method: 'PUT',
            headers: this.#headers(opts),
        });
    }

    /**
     * Unsubscribe from a mission
     *
     * {@link https://docs.tak.gov/api/takserver/redoc#tag/mission-api/operation/deleteMissionSubscription TAK Server Docs}.
     */
    async unsubscribe(
        name: string,
        query: Static<typeof UnsubscribeInput>,
        opts?: Static<typeof MissionOptions>
    ) {
        const url = this.#isGUID(name)
            ? new URL(`/Marti/api/missions/guid/${encodeURIComponent(name)}/subscription`, this.api.url)
            : new URL(`/Marti/api/missions/${this.#encodeName(name)}/subscription`, this.api.url);

        let q: keyof Static<typeof UnsubscribeInput>;
        for (q in query) {
            if (query[q] !== undefined) {
                url.searchParams.append(q, String(query[q]));
            }
        }

        return await this.api.fetch(url, {
            method: 'DELETE',
            headers: this.#headers(opts),
        });
    }

    /**
     * List missions in currently active channels
     *
     * {@link https://docs.tak.gov/api/takserver/redoc#tag/mission-api/operation/getAllMissions_1 TAK Server Docs}.
     */
    async list(query: Static<typeof MissionListInput>): Promise<Static<typeof TAKList_Mission>> {
        const url = new URL('/Marti/api/missions', this.api.url);

        let q: keyof Static<typeof MissionListInput>;
        for (q in query) {
            if (query[q] !== undefined) {
                url.searchParams.append(q, String(query[q]));
            }
        }

        return await this.api.fetch(url, {
            method: 'GET'
        });
    }

    /**
     * Get mission by its GUID
     *
     * {@link https://docs.tak.gov/api/takserver/redoc#tag/mission-api/operation/getMissionByGuid TAK Server Docs}.
     */
    async getGuid(
        guid: string,
        query: Static<typeof GetInput>,
        opts?: Static<typeof MissionOptions>
    ): Promise<Static<typeof Mission>> {
        const url = new URL(`/Marti/api/missions/guid/${encodeURIComponent(guid)}`, this.api.url);

        let q: keyof Static<typeof GetInput>;
        for (q in query) {
            if (query[q] !== undefined) {
                url.searchParams.append(q, String(query[q]));
            }
        }

        const missions: Static<typeof TAKList_Mission> = await this.api.fetch(url, {
            method: 'GET',
            headers: this.#headers(opts),
        });

        if (!missions.data.length) throw new Err(404, null, `No Mission for GUID: ${guid}`);
        return missions.data[0];
    }

    /**
     * Check if you have access to a given mission
     */
    async access(
        name: string,
        opts?: Static<typeof MissionOptions>
    ): Promise<boolean> {
        try {
            const url = this.#isGUID(name)
                ? new URL(`/Marti/api/missions/guid/${encodeURIComponent(name)}`, this.api.url)
                : new URL(`/Marti/api/missions/${this.#encodeName(name)}`, this.api.url);

            const missions: Static<typeof TAKList_Mission> = await this.api.fetch(url, {
                method: 'GET',
                headers: this.#headers(opts),
            });

            if (!missions.data.length) return false;
            return true;
        } catch (err) {
            console.error(err);
            return false;
        }
    }

    /**
     * Get mission by its Name
     *
     * {@link https://docs.tak.gov/api/takserver/redoc#tag/mission-api/operation/getMission TAK Server Docs}.
     */
    async get(
        name: string,
        query: Static<typeof GetInput>,
        opts?: Static<typeof MissionOptions>
    ): Promise<Static<typeof Mission>> {
        const url = this.#isGUID(name)
            ? new URL(`/Marti/api/missions/guid/${encodeURIComponent(name)}`, this.api.url)
            : new URL(`/Marti/api/missions/${this.#encodeName(name)}`, this.api.url);

        let q: keyof Static<typeof GetInput>;
        for (q in query) {
            if (query[q] !== undefined) {
                url.searchParams.append(q, String(query[q]));
            }
        }

        const missions: Static<typeof TAKList_Mission> = await this.api.fetch(url, {
            method: 'GET',
            headers: this.#headers(opts),
        });

        if (!missions.data.length) throw new Err(404, null, `No Mission for Name: ${name}`);

        return missions.data[0];
    }

    /**
     * Create a new mission
     *
     * {@link https://docs.tak.gov/api/takserver/redoc#tag/mission-api/operation/createMission TAK Server Docs}.
     */
    async create(
        name: string,
        query: Static<typeof MissionCreateInput>
    ): Promise<Static<typeof Mission>> {
        const url = new URL(`/Marti/api/missions/${this.#encodeName(name)}`, this.api.url);

        if (query.group && Array.isArray(query.group)) query.group = query.group.join(',');

        let q: keyof Static<typeof MissionCreateInput>;
        for (q in query) {
            if (query[q] !== undefined) {
                url.searchParams.append(q, String(query[q]));
            }
        }

        const missions = await this.api.fetch(url, {
            method: 'POST'
        });

        if (!missions.data.length) throw new Error('Create Mission didn\'t return a mission or an error');
        const mission = missions.data[0];

        return mission;
    }

    /**
     * Delete a mission
     *
     * {@link https://docs.tak.gov/api/takserver/redoc#tag/mission-api/operation/deleteMission TAK Server Docs}.
     */
    async delete(
        name: string,
        query: Static<typeof MissionDeleteInput>,
        opts?: Static<typeof MissionOptions>
    ) {
        if (this.#isGUID(name)) {
            const url = new URL('/Marti/api/missions', this.api.url);

            url.searchParams.append('guid', name);

            let q: keyof Static<typeof MissionDeleteInput>;
            for (q in query) {
                if (query[q] !== undefined) {
                    url.searchParams.append(q, String(query[q]));
                }
            }

            return await this.api.fetch(url, {
                method: 'DELETE',
                headers: this.#headers(opts),
            });
        } else {
            const url = new URL(`/Marti/api/missions/${this.#encodeName(name)}`, this.api.url);

            let q: keyof Static<typeof MissionDeleteInput>;
            for (q in query) {
                if (query[q] !== undefined) {
                    url.searchParams.append(q, String(query[q]));
                }
            }

            return await this.api.fetch(url, {
                method: 'DELETE',
                headers: this.#headers(opts),
            });
        }
    }
}

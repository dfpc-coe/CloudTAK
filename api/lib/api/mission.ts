import TAKAPI from '../tak-api.js';
import { Type, Static } from '@sinclair/typebox';
import Err from '@openaddresses/batch-error';
import { Readable } from 'node:stream'
import { TAKList } from './types.js';

export const Mission = Type.Object({
    name: Type.String(),
    description: Type.String(),
    chatRoom: Type.String(),
    baseLayer: Type.String(),
    bbox: Type.String(),
    path: Type.String(),
    classification: Type.String(),
    tool: Type.String(),
    keywords: Type.Array(Type.Unknown()),
    creatorUid: Type.String(),
    createTime: Type.String(),
    externalData: Type.Array(Type.Unknown()),
    feeds: Type.Array(Type.Unknown()),
    mapLayers: Type.Array(Type.Unknown()),
    ownerRole: Type.Array(Type.Unknown()),
    inviteOnly: Type.Boolean(),
    expiration: Type.Number(),
    guid: Type.String(),
    uids: Type.Array(Type.Unknown()),
    contents: Type.Array(Type.Object({
        data: Type.Object({
            name: Type.String(),
            hash: Type.String()
        })
    })),
    passwordProtected: Type.Boolean(),
    token: Type.Optional(Type.String()),                        // Only present when mission created
    groups: Type.Optional(Type.Array(Type.String())),           // Only present on Mission.get()
    missionChanges: Type.Optional(Type.Array(Type.Unknown()))   // Only present on Mission.get()
});

export const MissionSubscriber = Type.Object({
    token: Type.Optional(Type.String()),
    clientUid: Type.String(),
    username: Type.String(),
    createTime: Type.String(),
    role: Type.Object({
        permissions: Type.Array(Type.String()),
        hibernateLazyInitializer: Type.Any(),
        type: Type.String()
    })
})

export const AttachContentsInput = Type.Object({
    hashes: Type.Optional(Type.Array(Type.String())),
    uids: Type.Optional(Type.Array(Type.String())),
});

/**
 * @class
 */
export default class {
    api: TAKAPI;

    constructor(api: TAKAPI) {
        this.api = api;
    }

    #encodeName(name: string): string {
        return encodeURIComponent(name.trim())
    }

    /**
     * Return users associated with this mission
     */
    async contacts(name: string) {
        const url = new URL(`/Marti/api/missions/${this.#encodeName(name)}/contacts`, this.api.url);

        return await this.api.fetch(url, {
            method: 'GET'
        });
    }

    /**
     * Remove a file from the mission
     */
    async detachContents(name: string, hash: string) {
        const url = new URL(`/Marti/api/missions/${this.#encodeName(name)}/contents`, this.api.url);
        url.searchParams.append('hash', hash);

        return await this.api.fetch(url, {
            method: 'DELETE',
        });
    }

    /**
     * Attach a file resource by hash from the TAK Server file manager
     */
    async attachContents(name: string, body: Static<typeof AttachContentsInput>) {
        const url = new URL(`/Marti/api/missions/${this.#encodeName(name)}/contents`, this.api.url);

        return await this.api.fetch(url, {
            method: 'PUT',
            body
        });
    }

    /**
     * Upload a Mission Package
     */
    async upload(name: string, creatorUid: string, body: Readable) {
        const url = new URL(`/Marti/api/missions/${this.#encodeName(name)}/contents/missionpackage`, this.api.url);
        url.searchParams.append('creatorUid', creatorUid);

        return await this.api.fetch(url, {
            method: 'PUT',
            body
        });
    }

    /**
     * Return UIDs associated with any subscribed users
     */
    async subscriptions(name: string): Promise<TAKList<Static<typeof MissionSubscriber>>> {
        const url = new URL(`/Marti/api/missions/${this.#encodeName(name)}/subscriptions`, this.api.url);
        return await this.api.fetch(url, {
            method: 'GET'
        });
    }

    /**
     * Return permissions associated with any subscribed users
     */
    async subscriptionRoles(name: string): Promise<TAKList<any>> {
        const url = new URL(`/Marti/api/missions/${this.#encodeName(name)}/subscriptions/roles`, this.api.url);
        return await this.api.fetch(url, {
            method: 'GET'
        });
    }

    /**
     * Return permissions associated with a given mission if subscribed
     */
    async subscription(name: string): Promise<Static<typeof MissionSubscriber>> {
        const url = new URL(`/Marti/api/missions/${this.#encodeName(name)}/subscription`, this.api.url);
        const res = await this.api.fetch(url, {
            method: 'GET'
        });

        return res.data;
    }

    /**
     * Subscribe to a mission
     */
    async subscribe(name: string, query: {
        uid: string;
        password?: string;
        secago?: number;
        start?: string;
        end?: string;

        [key: string]: unknown;
    }) {
        const url = new URL(`/Marti/api/missions/${this.#encodeName(name)}/subscription`, this.api.url);

        for (const q in query) url.searchParams.append(q, String(query[q]));
        return await this.api.fetch(url, {
            method: 'PUT'
        });
    }

    /**
     * Get current subscription status
     */
    async subscribed(name: string, query: {
        uid: string;

        [key: string]: unknown;
    }) {
        const url = new URL(`/Marti/api/missions/${this.#encodeName(name)}/subscription`, this.api.url);

        for (const q in query) url.searchParams.append(q, String(query[q]));
        return await this.api.fetch(url, {
            method: 'GET'
        });
    }

    /**
     * Unsubscribe from a mission
     */
    async unsubscribe(name: string, query: {
        uid: string;
        disconnectOnly?: string;

        [key: string]: unknown;
    }) {
        const url = new URL(`/Marti/api/missions/${this.#encodeName(name)}/subscription`, this.api.url);

        for (const q in query) url.searchParams.append(q, String(query[q]));
        return await this.api.fetch(url, {
            method: 'DELETE'
        });
    }

    /**
     * List missions in currently active channels
     */
    async list(query: {
        passwordProtected?: string;
        defaultRole?: string;
        tool?: string;

        [key: string]: unknown;
    }) {
        const url = new URL('/Marti/api/missions', this.api.url);

        for (const q in query) url.searchParams.append(q, String(query[q]));
        return await this.api.fetch(url, {
            method: 'GET'
        });
    }

    /**
     * Get mission by its GUID
     */
    async getGuid(guid: string, query: {
        password?: string;
        changes?: string;
        logs?: string;
        secago?: string;
        start?: string;
        end?: string;

        [key: string]: unknown;
    }): Promise<Static<typeof Mission>> {
        const url = new URL(`/Marti/api/missions/guid/${encodeURIComponent(guid)}`, this.api.url);

        for (const q in query) url.searchParams.append(q, String(query[q]));
        const missions: TAKList<Static <typeof Mission>> = await this.api.fetch(url, {
            method: 'GET'
        });

        if (!missions.data.length) throw new Err(404, null, `No Mission for GUID: ${guid}`);
        return missions.data[0];
    }

    /**
     * Get mission by its Name
     */
    async get(name: string, query: {
        password?: string;
        changes?: string;
        logs?: string;
        secago?: string;
        start?: string;
        end?: string;

        [key: string]: unknown;
    }): Promise<Static<typeof Mission>> {
        name = name.trim();
        const url = new URL(`/Marti/api/missions/${this.#encodeName(name)}`, this.api.url);
        console.error(url)

        for (const q in query) url.searchParams.append(q, String(query[q]));

        const missions: TAKList<Static<typeof Mission>> = await this.api.fetch(url, {
            method: 'GET'
        });

        if (!missions.data.length) throw new Err(404, null, `No Mission for Name: ${name}`);
        return missions.data[0];
    }

    /**
     * Create a new mission
     */
    async create(name: string, query: {
        group: Array<string> | string;
        creatorUid: string;
        description?: string;
        chatRoom?: string;
        baseLayer?: string;
        bbox?: string;
        boundingPolygon?: string;
        path?: string;
        classification?: string;
        tool?: string;
        password?: string;
        defaultRole?: string;
        expiration?: string;
        inviteOnly?: string;
        allowDupe?: string;

        [key: string]: unknown;
    }): Promise<TAKList<Static<typeof Mission>>> {
        const url = new URL(`/Marti/api/missions/${this.#encodeName(name)}`, this.api.url);

        if (query.group && Array.isArray(query.group)) query.group = query.group.join(',');
        for (const q in query) url.searchParams.append(q, String(query[q]));
        return await this.api.fetch(url, {
            method: 'POST'
        });
    }

    /**
     * Delete a mission
     */
    async delete(name: string, query: {
        creatorUid?: string;
        deepDelete?: string;

        [key: string]: unknown;
    }) {
        const url = new URL(`/Marti/api/missions/${this.#encodeName(name)}`, this.api.url);

        for (const q in query) url.searchParams.append(q, String(query[q]));
        return await this.api.fetch(url, {
            method: 'DELETE'
        });
    }
}

import TAKAPI from '../tak-api.js';
import TAK from '@tak-ps/node-tak';
import { CoT } from '@tak-ps/node-tak';
import { Type, Static } from '@sinclair/typebox';
import Err from '@openaddresses/batch-error';
import { Readable } from 'node:stream'
import { TAKList } from './types.js';
import { MissionLog } from './mission-log.js';
import { Feature } from 'geojson';

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
    ownerRole: Type.Optional(Type.Array(Type.Unknown())),
    inviteOnly: Type.Boolean(),
    expiration: Type.Number(),
    guid: Type.String(),
    uids: Type.Array(Type.Unknown()),
    logs: Type.Optional(Type.Array(MissionLog)),                // Only present if ?logs=true
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

export const MissionChange = Type.Object({
    isFederatedChange: Type.Boolean(),
    type: Type.String(),
    missionName: Type.String(),
    timestamp: Type.String(),
    serverTime: Type.String(),
    creatorUid: Type.String(),
    contentUid: Type.Optional(Type.String()),
    details: Type.Optional(Type.Any()),
    contentResource: Type.Optional(Type.Any())
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

export const ChangesInput = Type.Object({
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

export const SubscribeInput = Type.Object({
    uid: Type.String(),
    password: Type.Optional(Type.String()),
    secago: Type.Optional(Type.Integer()),
    start: Type.Optional(Type.String()),
    end: Type.Optional(Type.String())
})

export const DeleteInput = Type.Object({
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

export const ListInput = Type.Object({
    passwordProtected: Type.Optional(Type.Boolean()),
    defaultRole: Type.Optional(Type.Boolean()),
    tool: Type.Optional(Type.String())
});

export const CreateInput = Type.Object({
    group: Type.Union([Type.Array(Type.String()), Type.String()]),
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

const GUIDMatch = new RegExp(/^[{]?[0-9a-fA-F]{8}-([0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}[}]?$/);

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

    async changes(
        name: string,
        query: Static<typeof ChangesInput>,
        opts?: Static<typeof MissionOptions>
    ): Promise<TAKList<Static<typeof MissionChange>>> {
        if (this.#isGUID(name)) name = (await this.getGuid(name, {})).name;

        const url = new URL(`/Marti/api/missions/${this.#encodeName(name)}/changes`, this.api.url);

        for (const q in query) url.searchParams.append(q, String(query[q]));
        return await this.api.fetch(url, {
            method: 'GET',
            headers: this.#headers(opts),
        });
    }

    async latestFeats(
        name: string,
        opts?: Static<typeof MissionOptions>
    ): Promise<Feature[]> {
        const feats: Feature[] = [];

        let partial = {
            event: '',
            remainder: await this.latestCots(name, opts),
            discard: ''
        };

        do {
            partial = TAK.findCoT(partial.remainder)
            if (partial && partial.event) feats.push((new CoT(partial.event)).to_geojson());
        } while (partial && partial.remainder);

        return feats;
    }

    async latestCots(
        name: string,
        opts?: Static<typeof MissionOptions>
    ): Promise<string> {
        if (this.#isGUID(name)) name = (await this.getGuid(name, {})).name;

        const url = new URL(`/Marti/api/missions/${this.#encodeName(name)}/cot`, this.api.url);

        return await this.api.fetch(url, {
            method: 'GET',
            headers: this.#headers(opts)
        });
    }

    /**
     * Return users associated with this mission
     */
    async contacts(
        name: string,
        opts?: Static<typeof MissionOptions>
    ) {
        if (this.#isGUID(name)) name = (await this.getGuid(name, {})).name;

        const url = new URL(`/Marti/api/missions/${this.#encodeName(name)}/contacts`, this.api.url);

        return await this.api.fetch(url, {
            method: 'GET',
            headers: this.#headers(opts)
        });
    }

    /**
     * Remove a file from the mission
     */
    async detachContents(
        name: string,
        body: Static<typeof DetachContentsInput>,
        opts?: Static<typeof MissionOptions>
    ) {
        if (this.#isGUID(name)) name = (await this.getGuid(name, {})).name;

        const url = new URL(`/Marti/api/missions/${this.#encodeName(name)}/contents`, this.api.url);
        if (body.hash) url.searchParams.append('hash', body.hash);
        if (body.uid) url.searchParams.append('uid', body.uid);

        return await this.api.fetch(url, {
            method: 'DELETE',
            headers: this.#headers(opts),
        });
    }

    /**
     * Attach a file resource by hash from the TAK Server file manager
     */
    async attachContents(
        name: string,
        body: Static<typeof AttachContentsInput>,
        opts?: Static<typeof MissionOptions>
    ) {
        if (this.#isGUID(name)) name = (await this.getGuid(name, {})).name;

        const url = new URL(`/Marti/api/missions/${this.#encodeName(name)}/contents`, this.api.url);

        return await this.api.fetch(url, {
            method: 'PUT',
            headers: this.#headers(opts),
            body
        });
    }

    /**
     * Upload a Mission Package
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
     */
    async subscriptions(
        name: string,
        opts?: Static<typeof MissionOptions>
    ): Promise<TAKList<Static<typeof MissionSubscriber>>> {
        if (this.#isGUID(name)) name = (await this.getGuid(name, {})).name;

        const url = new URL(`/Marti/api/missions/${this.#encodeName(name)}/subscriptions`, this.api.url);
        return await this.api.fetch(url, {
            method: 'GET',
            headers: this.#headers(opts),
        });
    }

    /**
     * Return permissions associated with any subscribed users
     */
    async subscriptionRoles(
        name: string,
        opts?: Static<typeof MissionOptions>
    ): Promise<TAKList<any>> {
        if (this.#isGUID(name)) name = (await this.getGuid(name, {})).name;

        const url = new URL(`/Marti/api/missions/${this.#encodeName(name)}/subscriptions/roles`, this.api.url);
        return await this.api.fetch(url, {
            method: 'GET',
            headers: this.#headers(opts),
        });
    }

    /**
     * Return permissions associated with a given mission if subscribed
     */
    async subscription(
        name: string,
        opts?: Static<typeof MissionOptions>
    ): Promise<Static<typeof MissionSubscriber>> {
        if (this.#isGUID(name)) name = (await this.getGuid(name, {})).name;

        const url = new URL(`/Marti/api/missions/${this.#encodeName(name)}/subscription`, this.api.url);
        const res = await this.api.fetch(url, {
            method: 'GET',
            headers: this.#headers(opts),
        });

        return res.data;
    }

    /**
     * Subscribe to a mission
     */
    async subscribe(
        name: string,
        query: Static<typeof SubscribeInput>,
        opts?: Static<typeof MissionOptions>
    ) {
        const url = new URL(`/Marti/api/missions/${this.#encodeName(name)}/subscription`, this.api.url);

        if (this.#isGUID(name)) name = (await this.getGuid(name, {})).name;

        for (const q in query) url.searchParams.append(q, String(query[q]));
        return await this.api.fetch(url, {
            method: 'PUT',
            headers: this.#headers(opts),
        });
    }

    /**
     * Get current subscription status
     */
    async subscribed(
        name: string,
        query: Static<typeof SubscribedInput>,
        opts?: Static<typeof MissionOptions>
    ) {
        const url = new URL(`/Marti/api/missions/${this.#encodeName(name)}/subscription`, this.api.url);

        if (this.#isGUID(name)) name = (await this.getGuid(name, {})).name;

        for (const q in query) url.searchParams.append(q, String(query[q]));
        return await this.api.fetch(url, {
            method: 'GET',
            headers: this.#headers(opts),
        });
    }

    /**
     * Unsubscribe from a mission
     */
    async unsubscribe(
        name: string,
        query: Static<typeof UnsubscribeInput>,
        opts?: Static<typeof MissionOptions>
    ) {
        const url = new URL(`/Marti/api/missions/${this.#encodeName(name)}/subscription`, this.api.url);

        if (this.#isGUID(name)) name = (await this.getGuid(name, {})).name;

        for (const q in query) url.searchParams.append(q, String(query[q]));
        return await this.api.fetch(url, {
            method: 'DELETE',
            headers: this.#headers(opts),
        });
    }

    /**
     * List missions in currently active channels
     */
    async list(query: Static<typeof ListInput>) {
        const url = new URL('/Marti/api/missions', this.api.url);

        for (const q in query) url.searchParams.append(q, String(query[q]));
        return await this.api.fetch(url, {
            method: 'GET'
        });
    }

    /**
     * Get mission by its GUID
     */
    async getGuid(
        guid: string,
        query: Static<typeof GetInput>,
        opts?: Static<typeof MissionOptions>
    ): Promise<Static<typeof Mission>> {
        const url = new URL(`/Marti/api/missions/guid/${encodeURIComponent(guid)}`, this.api.url);

        for (const q in query) url.searchParams.append(q, String(query[q]));
        const missions: TAKList<Static <typeof Mission>> = await this.api.fetch(url, {
            method: 'GET',
            headers: this.#headers(opts),
        });

        if (!missions.data.length) throw new Err(404, null, `No Mission for GUID: ${guid}`);
        return missions.data[0];
    }

    /**
     * Get mission by its Name
     */
    async get(
        name: string,
        query: Static<typeof GetInput>,
        opts?: Static<typeof MissionOptions>
    ): Promise<Static<typeof Mission>> {
        const url = new URL(`/Marti/api/missions/${this.#encodeName(name)}`, this.api.url);

        if (this.#isGUID(name)) name = (await this.getGuid(name, {})).name;

        for (const q in query) url.searchParams.append(q, String(query[q]));

        const missions: TAKList<Static<typeof Mission>> = await this.api.fetch(url, {
            method: 'GET',
            headers: this.#headers(opts),
        });

        if (!missions.data.length) throw new Err(404, null, `No Mission for Name: ${name}`);
        return missions.data[0];
    }

    /**
     * Create a new mission
     */
    async create(
        name: string,
        query: Static<typeof CreateInput>
    ): Promise<TAKList<Static<typeof Mission>>> {
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
    async delete(
        name: string,
        query: Static<typeof DeleteInput>,
        opts?: Static<typeof MissionOptions>
    ) {
        const url = new URL(`/Marti/api/missions/${this.#encodeName(name)}`, this.api.url);

        if (this.#isGUID(name)) name = (await this.getGuid(name, {})).name;

        for (const q in query) url.searchParams.append(q, String(query[q]));
        return await this.api.fetch(url, {
            method: 'DELETE',
            headers: this.#headers(opts),
        });
    }
}

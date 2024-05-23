import TAKAPI from '../tak-api.js';
import { TAKList } from './types.js';
import { Type, Static } from '@sinclair/typebox';
import { MissionOptions } from './mission.js';

export enum MissionLayerType {
    GROUP = 'GROUP',
    UID = 'UID',
    CONTENTS = 'CONTENTS',
    MAPLAYER = 'MAPLAYER',
    ITEM = 'ITEM'
}

export const MissionLayer = Type.Object({
    name: Type.String(),
    type: Type.Enum(MissionLayerType),
    parentUid: Type.String(),
    uid: Type.String(),
    mission_layers: Type.Array(Type.Any()),
    uids: Type.Array(Type.Object({
        data: Type.String(),
        timestamp: Type.String(),
        creatorUid: Type.String(),
        keywords: Type.Array(Type.String())
    })),
    contents: Type.Array(Type.Any()),
    maplayers: Type.Array(Type.Any())
});

export const DeleteInput = Type.Object({
    uid: Type.Array(Type.String()),
    creatorUid: Type.String(),
});

export const RenameInput = Type.Object({
    name: Type.String(),
    creatorUid: Type.String(),
});

export const CreateInput = Type.Object({
    name: Type.String(),
    type: Type.Enum(MissionLayerType),
    uid: Type.Optional(Type.String()),
    parentUid: Type.Optional(Type.String()),
    afterUid: Type.Optional(Type.String()),
    creatorUid: Type.Optional(Type.String())
})

export default class {
    api: TAKAPI;

    constructor(api: TAKAPI) {
        this.api = api;
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

    async list(
        name: string,
        opts?: Static<typeof MissionOptions>
    ): Promise<TAKList<Static<typeof MissionLayer>>> {
        const url = new URL(`/Marti/api/missions/${this.#encodeName(name)}/layers`, this.api.url);

        return await this.api.fetch(url, {
            method: 'GET',
            headers: this.#headers(opts),
        });
    }

    async get(
        name: string,
        layerUid: string,
        opts?: Static<typeof MissionOptions>
    ): Promise<TAKList<Static<typeof MissionLayer>>> {
        const url = new URL(`/Marti/api/missions/${this.#encodeName(name)}/layers/${layerUid}`, this.api.url);

        return await this.api.fetch(url, {
            method: 'GET',
            headers: this.#headers(opts),
        });
    }

    async create(
        name: string,
        query: Static<typeof CreateInput>,
        opts?: Static<typeof MissionOptions>
    ) {
        const url = new URL(`/Marti/api/missions/${this.#encodeName(name)}/layers`, this.api.url);

        for (const q in query) url.searchParams.append(q, String(query[q]));
        return await this.api.fetch(url, {
            method: 'PUT',
            headers: this.#headers(opts),
        });
    }

    async rename(
        name: string,
        layer: string,
        query: Static<typeof RenameInput>,
        opts?: Static<typeof MissionOptions>
    ) {
        const url = new URL(`/Marti/api/missions/${this.#encodeName(name)}/layers/${layer}/name`, this.api.url);

        for (const q in query) url.searchParams.append(q, String(query[q]));
        return await this.api.fetch(url, {
            method: 'PUT',
            headers: this.#headers(opts),
        });
    }

    async delete(
        name: string,
        query: Static<typeof DeleteInput>,
        opts?: Static<typeof MissionOptions>
    ) {
        const url = new URL(`/Marti/api/missions/${this.#encodeName(name)}/layers`, this.api.url);

        for (const q in query) url.searchParams.append(q, String(query[q]));
        return await this.api.fetch(url, {
            method: 'DELETE',
            headers: this.#headers(opts),
        });
    }
}

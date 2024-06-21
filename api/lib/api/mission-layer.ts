import TAKAPI from '../tak-api.js';
import { TAKList } from './types.js';
import { Type, Static } from '@sinclair/typebox';
import { MissionOptions } from './mission.js';
import Err from '@openaddresses/batch-error';
import { Feature } from '@tak-ps/node-cot';

export enum MissionLayerType {
    GROUP = 'GROUP',
    UID = 'UID',
    CONTENTS = 'CONTENTS',
    MAPLAYER = 'MAPLAYER',
    ITEM = 'ITEM'
}

export const MissionLayer = Type.Object({
    name: Type.String({ minLength: 1 }),
    type: Type.Enum(MissionLayerType),
    parentUid: Type.String(),
    uid: Type.String(),
    mission_layers: Type.Array(Type.Any()),
    uids: Type.Array(Type.Object({
        data: Type.String({
            description: 'The UID of the COT'
        }),
        timestamp: Type.String(),
        creatorUid: Type.String(),
        keywords: Type.Optional(Type.Array(Type.String())),
        detail: Type.Optional(Type.Object({
            type: Type.String(),
            callsign: Type.String(),
            color: Type.String(),
            location: Type.Object({
                lat: Type.Number(),
                lon: Type.Number()
            })
        }))
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
    creatorUid: Type.String()
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

        const res = await this.api.fetch(url, {
            method: 'GET',
            headers: this.#headers(opts),
        });

        res.data.map((l) => {
            if (l.type === MissionLayerType.UID && !l.uids) {
                l.uids = [];
            }
            return l;
        })

        return res;
    }

    /**
     * Stopgap function until the main latestFeats function can accept a path
     * parameter
     */
    async latestFeats(
        name: string,
        layerUid: string, // Layer UID
        opts?: Static<typeof MissionOptions>
    ): Promise<Static<typeof Feature>[]> {
        const layer = await this.get(name, layerUid, opts);
        const feats = await this.api.Mission.latestFeats(name, opts);

        const layerUids = new Set(layer.uids.map((u) => {
            return u.data
        }));

        return feats.filter((f) => {
            return layerUids.has(f.id)
        });
    }

    async get(
        name: string,
        layerUid: string, // Layer UID
        opts?: Static<typeof MissionOptions>
    ): Promise<Static<typeof MissionLayer>> {
        const layers = await this.list(name, opts);

        for (const layer of layers.data) {
            if (layer.uid === layerUid) {
                return layer;
            }
        }

        throw new Err(404, null, `Layer ${layerUid} not found`);
    }

    async create(
        name: string,
        query: Static<typeof CreateInput>,
        opts?: Static<typeof MissionOptions>
    ): Promise<TAKList<Static<typeof MissionLayer>>> {
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

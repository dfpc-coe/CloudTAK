import TAKAPI from '../tak-api.js';
import { TAKList, TAKItem } from './types.js';
import { Type, Static } from '@sinclair/typebox';
import type { MissionOptions } from './mission.js';
import { GUIDMatch } from './mission.js';
import Err from '@openaddresses/batch-error';
import type { Feature } from '@tak-ps/node-cot';

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
    parentUid: Type.Optional(Type.String()),
    uid: Type.String(),
    mission_layers: Type.Optional(Type.Array(Type.Any())),
    uids: Type.Optional(Type.Array(Type.Object({
        data: Type.String({
            description: 'The UID of the COT'
        }),
        timestamp: Type.String(),
        creatorUid: Type.String(),
        keywords: Type.Optional(Type.Array(Type.String())),
        details: Type.Optional(Type.Object({
            type: Type.String(),
            callsign: Type.String(),
            color: Type.Optional(Type.String()),
            location: Type.Object({
                lat: Type.Number(),
                lon: Type.Number()
            })
        }))
    }))),
    contents: Type.Optional(Type.Array(Type.Any())),
    maplayers: Type.Optional(Type.Array(Type.Any()))
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

export const TAKList_MissionLayer = TAKList(MissionLayer);
export const TAKItem_MissionLayer = TAKItem(MissionLayer);

export default class {
    api: TAKAPI;

    constructor(api: TAKAPI) {
        this.api = api;
    }

    #encodeName(name: string): string {
        return encodeURIComponent(name.trim())
    }

    #isGUID(id: string): boolean {
        return GUIDMatch.test(id)
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

    isEmpty(layer: Static<typeof MissionLayer>): boolean {
        if (layer.mission_layers && layer.mission_layers.length) return false;
        if (layer.uids && layer.uids.length) return false;
        if (layer.contents && layer.contents.length) return false;
        if (layer.maplayers && layer.maplayers.length) return false;
        return true;
    }

    async listAsPathMap(
        name: string,
        opts?: Static<typeof MissionOptions>
    ): Promise<Map<string, Static<typeof MissionLayer>>> {
        const layers = (await this.list(name, opts)).data;

        const pathMap: Map<string, Static<typeof MissionLayer>> = new Map();

        for (const layer of layers) {
            this.#listAsPathMapRecurse(pathMap, '', layer);
        }

        return pathMap;
    }

    #listAsPathMapRecurse(
        pathMap: Map<string, Static<typeof MissionLayer>>,
        pathCurrent: string,
        layer: Static<typeof MissionLayer>
    ) {
        pathCurrent = `${pathCurrent}/${encodeURIComponent(layer.name)}`;
        pathMap.set(`${pathCurrent}/`, layer);

        for (const l of (layer.mission_layers || []) as Array<Static<typeof MissionLayer>>) {
            this.#listAsPathMapRecurse(pathMap, pathCurrent, l);
        }
    }

    async list(
        name: string,
        opts?: Static<typeof MissionOptions>
    ): Promise<Static<typeof TAKList_MissionLayer>> {
        let res;

        if (this.#isGUID(name)) {
            const url = new URL(`/Marti/api/missions/guid/${this.#encodeName(name)}/layers`, this.api.url);

            res = await this.api.fetch(url, {
                method: 'GET',
                headers: this.#headers(opts),
            });
        } else {
            const url = new URL(`/Marti/api/missions/${this.#encodeName(name)}/layers`, this.api.url);

            res = await this.api.fetch(url, {
                method: 'GET',
                headers: this.#headers(opts),
            });
        }

        res.data.map((l: Static<typeof MissionLayer>) => {
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
    ): Promise<Static<typeof Feature.Feature>[]> {
        const layer = (await this.get(name, layerUid, opts)).data;
        const feats = await this.api.Mission.latestFeats(name, opts);

        const layerUids = new Set((layer.uids || []).map((u) => {
            return u.data
        }));

        const filtered = feats.filter((f) => {
            return layerUids.has(f.id)
        });

        return filtered;
    }

    async get(
        name: string,
        layerUid: string, // Layer UID
        opts?: Static<typeof MissionOptions>
    ): Promise<Static<typeof TAKItem_MissionLayer>> {
        const layers = await this.list(name, opts);

        // TODO this will only return top level layers - need to recurse to lower level layers
        for (const layer of layers.data) {
            if (layer.uid === layerUid) {
                return {
                    version: layers.version,
                    type: layers.type,
                    data: layer,
                    nodeId: layers.nodeId
                }
            }
        }

        throw new Err(404, null, `Layer ${layerUid} not found - only top level layers will be returned`);
    }

    async create(
        name: string,
        query: Static<typeof CreateInput>,
        opts?: Static<typeof MissionOptions>
    ): Promise<Static<typeof TAKItem_MissionLayer>> {
        if (this.#isGUID(name)) {
            const url = new URL(`/Marti/api/missions/guid/${this.#encodeName(name)}/layers`, this.api.url);

            let q: keyof Static<typeof CreateInput>;
            for (q in query) {
                if (query[q] !== undefined) {
                    url.searchParams.append(q, String(query[q]));
                }
            }

            return await this.api.fetch(url, {
                method: 'PUT',
                headers: this.#headers(opts),
            });
        } else {
            const url = new URL(`/Marti/api/missions/${this.#encodeName(name)}/layers`, this.api.url);

            let q: keyof Static<typeof CreateInput>;
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
    }

    async rename(
        name: string,
        layer: string,
        query: Static<typeof RenameInput>,
        opts?: Static<typeof MissionOptions>
    ) {
        if (this.#isGUID(name)) {
            const url = new URL(`/Marti/api/missions/guid/${this.#encodeName(name)}/layers/${layer}/name`, this.api.url);

            let q: keyof Static<typeof RenameInput>;
            for (q in query) {
                if (query[q] !== undefined) {
                    url.searchParams.append(q, String(query[q]));
                }
            }

            return await this.api.fetch(url, {
                method: 'PUT',
                headers: this.#headers(opts),
            });
        } else {
            const url = new URL(`/Marti/api/missions/${this.#encodeName(name)}/layers/${layer}/name`, this.api.url);

            let q: keyof Static<typeof RenameInput>;
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
    }

    async delete(
        name: string,
        query: Static<typeof DeleteInput>,
        opts?: Static<typeof MissionOptions>
    ) {
        if (this.#isGUID(name)) {
            const url = new URL(`/Marti/api/missions/guid/${this.#encodeName(name)}/layers`, this.api.url);

            let q: keyof Static<typeof DeleteInput>;
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
            const url = new URL(`/Marti/api/missions/${this.#encodeName(name)}/layers`, this.api.url);

            let q: keyof Static<typeof DeleteInput>;
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

import TAKAPI from '../tak-api.js';
import { Type, Static } from '@sinclair/typebox';
import { MissionOptions } from './mission.js';

export const MissionLog = Type.Object({
    id: Type.String(),
    content: Type.String(),
    creatorUid: Type.String(),
    missionNames: Type.Array(Type.String()),
    servertime: Type.String(),
    dtg: Type.Optional(Type.String()),
    created: Type.String(),
    contentHashes: Type.Array(Type.Unknown()),
    keywords: Type.Array(Type.Unknown())
});


export default class {
    api: TAKAPI;

    constructor(api: TAKAPI) {
        this.api = api;
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

    async delete(
        log: string,
        opts?: Static<typeof MissionOptions>
    ) {
        const url = new URL(`/Marti/api/missions/logs/entries/${log}`, this.api.url);

        return await this.api.fetch(url, {
            method: 'DELETE',
            headers: this.#headers(opts),
        });
    }

    async create(
        mission: string,
        body: {
            content: string;
            creatorUid: string;
        },
        opts?: Static<typeof MissionOptions>
    ) {
        const url = new URL(`/Marti/api/missions/logs/entries`, this.api.url);

        return await this.api.fetch(url, {
            method: 'POST',
            headers: this.#headers(opts),
            body: {
                content: body.content,
                creatorUid: body.creatorUid,
                missionNames: [ mission ],
            }
        });
    }
}

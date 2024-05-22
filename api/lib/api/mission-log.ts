import TAKAPI from '../tak-api.js';
import { Type } from '@sinclair/typebox';

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

    async delete(log: string) {
        const url = new URL(`/Marti/api/missions/logs/entries/${log}`, this.api.url);

        return await this.api.fetch(url, {
            method: 'DELETE',
        });
    }

    async create(mission: string, opts: {
        content: string;
        creatorUid: string;

    }) {
        const url = new URL(`/Marti/api/missions/logs/entries`, this.api.url);

        return await this.api.fetch(url, {
            method: 'POST',
            body: {
                content: opts.content,
                creatorUid: opts.creatorUid,
                missionNames: [ mission ],
            }
        });
    }
}

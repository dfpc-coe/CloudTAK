import TAKAPI from '../tak-api.js';
import { Type, Static } from '@sinclair/typebox';
import { TAKItem } from './types.js';
import type { MissionOptions } from './mission.js';
import { GUIDMatch } from './mission.js';

export const MissionLog = Type.Object({
    id: Type.String(),
    content: Type.String(),
    creatorUid: Type.String(),
    missionNames: Type.Array(Type.String()),
    servertime: Type.String(),
    dtg: Type.Optional(Type.String()),
    created: Type.String(),
    contentHashes: Type.Array(Type.Unknown()),
    keywords: Type.Array(Type.String())
});

export const CreateMissionLog = Type.Object({
    content: Type.String(),
    creatorUid: Type.String(),
    contentHashes: Type.Optional(Type.Array(Type.Unknown())),
    keywords: Type.Optional(Type.Array(Type.String()))
});

export const UpdateMissionLog = Type.Composite([ CreateMissionLog, Type.Object({
    id: Type.String()
})]);

export const TAKItem_MissionLog = TAKItem(MissionLog);

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

    #isGUID(id: string): boolean {
        return GUIDMatch.test(id)
    }

    /**
     * Delete a log entry on a Mission Sync
     *
     * {@link https://docs.tak.gov/api/takserver/redoc#tag/mission-api/operation/deleteLogEntry TAK Server Docs}.
     */
    async delete(
        log: string,
        opts?: Static<typeof MissionOptions>
    ): Promise<void> {
        const url = new URL(`/Marti/api/missions/logs/entries/${log}`, this.api.url);

        await this.api.fetch(url, {
            method: 'DELETE',
            headers: this.#headers(opts),
        });

        return;
    }

    /**
     * Get a log entry on a Mission Sync
     *
     * {@link https://docs.tak.gov/api/takserver/redoc#tag/mission-api/operation/getOneLogEntry TAK Server Docs}.
     */
    async get(
        id: string,
    ): Promise<Static<typeof TAKItem_MissionLog>> {
        const url = new URL(`/Marti/api/missions/logs/entries/${encodeURIComponent(id)}`, this.api.url);

        return await this.api.fetch(url);
    }

    /**
     * Create a log entry on a Mission Sync
     *
     * {@link https://docs.tak.gov/api/takserver/redoc#tag/mission-api/operation/postLogEntry TAK Server Docs}.
     */
    async create(
        mission: string,
        body: Static<typeof CreateMissionLog>,
        opts?: Static<typeof MissionOptions>
    ): Promise<Static<typeof TAKItem_MissionLog>> {
        const url = new URL(`/Marti/api/missions/logs/entries`, this.api.url);

        if (this.#isGUID(mission)) {
            mission = (await this.api.Mission.get(mission, {}, opts)).name;
        }

        return await this.api.fetch(url, {
            method: 'POST',
            headers: this.#headers(opts),
            body: {
                content: body.content,
                creatorUid: body.creatorUid,
                keywords: body.keywords,
                missionNames: [ mission ],
            }
        });
    }

    /**
     * Update a log entry on a Mission Sync
     *
     * {@link https://docs.tak.gov/api/takserver/redoc#tag/mission-api/operation/updateLogEntry TAK Server Docs}.
     */
    async update(
        mission: string,
        body: Static<typeof UpdateMissionLog>,
        opts?: Static<typeof MissionOptions>
    ): Promise<Static<typeof TAKItem_MissionLog>> {
        const url = new URL(`/Marti/api/missions/logs/entries`, this.api.url);

        if (this.#isGUID(mission)) {
            mission = (await this.api.Mission.get(mission, {}, opts)).name;
        }

        return await this.api.fetch(url, {
            method: 'PUT',
            headers: this.#headers(opts),
            body: {
                content: body.content,
                creatorUid: body.creatorUid,
                keywords: body.keywords,
                missionNames: [ mission ],
            }
        });
    }
}

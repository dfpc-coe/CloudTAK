import TAKAPI from '../tak-api.js';
import { Type, Static } from '@sinclair/typebox';

export const Package = Type.Object({
    EXPIRATION: Type.String(),
    UID: Type.String(),
    SubmissionDateTime: Type.String(),
    Keywords: Type.Array(Type.String()),
    MIMEType: Type.String(),
    Size: Type.String(),
    SubmissionUser: Type.String(),
    PrimaryKey: Type.String(),
    Hash: Type.String(),
    CreatorUid: Type.Optional(Type.Union([Type.Null(), Type.String()])),
    Name: Type.String(),
    Tool: Type.String()
});

export const ListInput = Type.Object({
    tool: Type.Optional(Type.String()),
    uid: Type.Optional(Type.String())
});

/**
 * @class
 */
export default class {
    api: TAKAPI;

    constructor(api: TAKAPI) {
        this.api = api;
    }

    async list(query: Static<typeof ListInput>): Promise<{
        resultCount: number;
        results: Array<Static<typeof Package>>
    }> {
        const url = new URL(`/Marti/sync/search`, this.api.url);

        let q: keyof Static<typeof ListInput>;
        for (q in query) {
            if (query[q] !== undefined) {
                url.searchParams.append(q, String(query[q]));
            }
        }

        const res = await this.api.fetch(url, {
            method: 'GET'
        });

        return JSON.parse(res) as {
            resultCount: number;
            results: Array<Static<typeof Package>>
        };
    }
}

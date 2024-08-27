import { Static, Type } from '@sinclair/typebox';
import TAKAPI from '../tak-api.js';
import { TAKList } from './types.js';

export const Group = Type.Object({
    name: Type.String(),
    direction: Type.String(),
    created: Type.String(),
    type: Type.String(),
    bitpos: Type.Number(),
    active: Type.Boolean(),
    description: Type.Optional(Type.String())
})


export default class {
    api: TAKAPI;

    constructor(api: TAKAPI) {
        this.api = api;
    }

    async list(query: {
        useCache?: string;

        [key: string]: unknown;
    }): Promise<TAKList<Static<typeof Group>>> {
        const url = new URL(`/Marti/api/groups/all`, this.api.url);
        for (const q in query) url.searchParams.append(q, String(query[q]));
        return await this.api.fetch(url, {
            method: 'GET'
        });
    }

    async update(body: Group[], query: {
        clientUid?: string;

        [key: string]: unknown;
    }): Promise<void> {
        const url = new URL(`/Marti/api/groups/active`, this.api.url);
        for (const q in query) url.searchParams.append(q, String(query[q]));

        await this.api.fetch(url, {
            method: 'PUT',
            body
        });
    }
}

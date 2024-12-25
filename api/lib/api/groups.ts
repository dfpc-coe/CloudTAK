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

export const GroupListInput = Type.Object({
    useCache: Type.Optional(Type.Boolean())
})

export const TAKList_Group = TAKList(Group);

export default class {
    api: TAKAPI;

    constructor(api: TAKAPI) {
        this.api = api;
    }

    async list(
        query: Static<typeof GroupListInput> = {}
    ): Promise<Static<typeof TAKList_Group>> {
        const url = new URL(`/Marti/api/groups/all`, this.api.url);

        let q: keyof Static<typeof GroupListInput>;
        for (q in query) {
            if (query[q] !== undefined) {
                url.searchParams.append(q, String(query[q]));
            }
        }

        return await this.api.fetch(url, {
            method: 'GET'
        });
    }

    async update(
        body: Static<typeof Group>[],
        query: Static<typeof GroupListInput> = {}
    ): Promise<void> {
        const url = new URL(`/Marti/api/groups/active`, this.api.url);

        let q: keyof Static<typeof GroupListInput>;
        for (q in query) {
            if (query[q] !== undefined) {
                url.searchParams.append(q, String(query[q]));
            }
        }

        await this.api.fetch(url, {
            method: 'PUT',
            body
        });
    }
}

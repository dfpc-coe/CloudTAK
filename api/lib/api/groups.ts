import TAKAPI from '../tak-api.js';
import { TAKList } from './types.js';

export type Group = {
    name: string;
    direction: string;
    created: string;
    type: string;
    bitpos: number;
    active: boolean;
    description: string;
}


export default class {
    api: TAKAPI;

    constructor(api: TAKAPI) {
        this.api = api;
    }

    async list(query: {
        useCache?: string;
    }): Promise<TAKList<Group>> {
        const url = new URL(`/Marti/api/groups/all`, this.api.url);
        for (const q in query) url.searchParams.append(q, query[q]);
        return await this.api.fetch(url, {
            method: 'GET'
        });
    }

    async update(query: {
        clientUid?: string;
    }, body: object[]) {
        const url = new URL(`/Marti/api/groups/active`, this.api.url);
        for (const q in query) url.searchParams.append(q, query[q]);

        return await this.api.fetch(url, {
            method: 'PUT',
            body
        });
    }
}

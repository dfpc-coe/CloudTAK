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

        [key: string]: unknown;
    }): Promise<TAKList<Group>> {
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

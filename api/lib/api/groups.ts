import TAKAPI from '../tak-api.ts';

export default class {
    api: TAKAPI;

    constructor(api: TAKAPI) {
        this.api = api;
    }

    async list(query: {
        useCache?: string;
    }) {
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

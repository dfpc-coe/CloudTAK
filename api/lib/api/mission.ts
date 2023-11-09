import TAKAPI from '../tak-api.js';

export default class {
    api: TAKAPI;

    constructor(api: TAKAPI) {
        this.api = api;
    }

    async list(query: {
        passwordProtected?: String;
        defaultRole?: String;
        tool?: String;
    }) {
        const url = new URL('/Marti/api/missions', this.api.url);

        for (const q in query) url.searchParams.append(q, query[q]);
        return await this.api.fetch(url, {
            method: 'GET'
        });
    }

    async get(name: string, query: {
        password?: String;
        changes?: String;
        logs?: String;
        secago?: String;
        start?: String;
        end?: String;
    }) {
        const url = new URL(`/Marti/api/missions/${encodeURIComponent(name)}`, this.api.url);

        for (const q in query) url.searchParams.append(q, query[q]);
        return await this.api.fetch(url, {
            method: 'GET'
        });
    }
}

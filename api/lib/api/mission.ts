import TAKAPI from '../tak-api.js';
import { Readable } from 'node:stream'

export default class {
    api: TAKAPI;

    constructor(api: TAKAPI) {
        this.api = api;
    }

    async contacts(name: string) {
        const url = new URL(`/Marti/api/missions/${encodeURIComponent(name)}/contacts`, this.api.url);

        return await this.api.fetch(url, {
            method: 'GET'
        });
    }

    async detachContents(name: string, hash: string) {
        const url = new URL(`/Marti/api/missions/${encodeURIComponent(name)}/contents`, this.api.url);
        url.searchParams.append('hash', hash);

        return await this.api.fetch(url, {
            method: 'DELETE',
        });
    }

    async attachContents(name: string, hashes: string[]) {
        const url = new URL(`/Marti/api/missions/${encodeURIComponent(name)}/contents`, this.api.url);

        return await this.api.fetch(url, {
            method: 'PUT',
            body: {
                hashes: hashes
            }
        });
    }

    async upload(name: string, creatorUid: string, body: Readable) {
        const url = new URL(`/Marti/api/missions/${encodeURIComponent(name)}/contents/missionpackage`, this.api.url);
        url.searchParams.append('creatorUid', creatorUid);

        return await this.api.fetch(url, {
            method: 'PUT',
            body
        });
    }

    async list(query: {
        passwordProtected?: string;
        defaultRole?: string;
        tool?: string;
    }) {
        const url = new URL('/Marti/api/missions', this.api.url);

        for (const q in query) url.searchParams.append(q, query[q]);
        return await this.api.fetch(url, {
            method: 'GET'
        });
    }

    async get(name: string, query: {
        password?: string;
        changes?: string;
        logs?: string;
        secago?: string;
        start?: string;
        end?: string;
    }) {
        const url = new URL(`/Marti/api/missions/${encodeURIComponent(name)}`, this.api.url);

        for (const q in query) url.searchParams.append(q, query[q]);
        return await this.api.fetch(url, {
            method: 'GET'
        });
    }

    async create(name: string, query: {
        creatorUid?: string;
        group?: Array<string> | string;
        description?: string;
        chatRoom?: string;
        baseLayer?: string;
        bbox?: string;
        boundingPolygon?: string;
        path?: string;
        classification?: string;
        tool?: string;
        password?: string;
        defaultRole?: string;
        expiration?: string;
        inviteOnly?: string;
        allowDupe?: string;
    }) {
        const url = new URL(`/Marti/api/missions/${encodeURIComponent(name)}`, this.api.url);

        if (query.group && Array.isArray(query.group)) query.group = query.group.join(',');
        for (const q in query) url.searchParams.append(q, query[q]);
        return await this.api.fetch(url, {
            method: 'POST'
        });
    }

    async delete(name: string, query: {
        creatorUid?: string;
        deepDelete?: string;
    }) {
        const url = new URL(`/Marti/api/missions/${encodeURIComponent(name)}`, this.api.url);

        for (const q in query) url.searchParams.append(q, query[q]);
        return await this.api.fetch(url, {
            method: 'DELETE'
        });
    }
}

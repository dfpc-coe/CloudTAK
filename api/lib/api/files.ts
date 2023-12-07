import TAKAPI from '../tak-api.js';

export default class {
    api: TAKAPI;

    constructor(api: TAKAPI) {
        this.api = api;
    }

    async download(hash: string) {
        const url = new URL(`/Marti/api/files/${hash}`, this.api.url);

        const res = await this.api.fetch(url, {
            method: 'GET'
        }, true);

        return res.body.getReader();
    }

    async count() {
        const url = new URL('/Marti/api/files/metadata/count', this.api.url);

        return await this.api.fetch(url, {
            method: 'GET'
        });
    }

    async config() {
        const url = new URL('/files/api/config', this.api.url);

        return await this.api.fetch(url, {
            method: 'GET'
        });
    }
}

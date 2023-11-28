import TAKAPI from '../tak-api.js';

export default class {
    api: TAKAPI;

    constructor(api: TAKAPI) {
        this.api = api;
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

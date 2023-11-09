import TAKAPI from '../tak-api.js';

export default class {
    api: TAKAPI;

    constructor(api: TAKAPI) {
        this.api = api;
    }

    async list() {
        return await this.api.fetch(new URL('/Marti/api/missions', this.api.url), {
            method: 'GET'
        });
    }
}

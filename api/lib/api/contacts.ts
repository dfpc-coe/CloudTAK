import TAKAPI from '../tak-api.js';

export default class {
    api: TAKAPI;

    constructor(api: TAKAPI) {
        this.api = api;
    }

    async list() {
        const url = new URL(`/Marti/api/contacts/all`, this.api.url);
        return await this.api.fetch(url, {
            method: 'GET'
        });
    }
}

import TAKAPI from '../tak-api.js';

export default class {
    api: TAKAPI;

    constructor(api: TAKAPI) {
        this.api = api;
    }

    async list() {
        return await this.api.fetch(new URL('/Marti/api/missions/', this.api.url), {
            method: 'GET'
        });
    }

    async create(missionid: number) {
        return await this.api.fetch(new URL(`/Marti/api/missions/${missionid}`, this.api.url), {
            method: 'POST'
        });
    }

    async from(missionid: number) {
        return await this.api.fetch(new URL(`/Marti/api/missions/${missionid}`, this.api.url), {
            method: 'GET'
        });
    }

    async raw(missionid: number) {
        return await this.api.fetch(new URL(`/Marti/api/missions/${missionid}/archive`, this.api.url), {
            method: 'GET'
        });
    }
}

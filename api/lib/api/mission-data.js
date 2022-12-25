export default class {
    constructor(api) {
        this.api = api;
    }

    async list() {
        return await this.api.fetch('/Marti/api/missions/');
    }

    async create(mission) {
        return await this.api.fetch(`/Marti/api/missions/${mission}`, {
            method: 'POST'
        });
    }

    async from(mission) {
        return await this.api.fetch(`/Marti/api/missions/${mission}`);
    }

    async raw(mission) {
        return await this.api.fetch(`/Marti/api/missions/${mission}/archive`);
    }
}

import fs from 'fs';

Object.assign(process.env, JSON.parse(fs.readFileSync(new URL('.env', import.meta.url))));

export default class Task {
    constructor() {
        this.token = process.env.COTRIP_TOKEN;
        this.api = 'https://data.cotrip.org/';
        if (!this.token) throw new Error('No COTrip API Token Provided');
    }

    async control() {
        await this.plows();
    }

    async plows() {
        const url = new URL('/api/v1/snowPlows', this.api);
        url.searchParams.append('apiKey', this.token);
        const res = await fetch(url);
        const plows = await res.json();

        for (const plow of plows.features) {
            console.error(plow);
        }
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    const task = new Task();
    task.control();
}


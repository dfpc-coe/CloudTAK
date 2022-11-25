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
        const plows = [];
        let batch = -1;
        let res;
        do {
            console.error(`ok - fetching ${++batch} of plows`);
            const url = new URL('/api/v1/snowPlows', this.api);
            url.searchParams.append('apiKey', this.token);
            if (res) url.searchParams.append('offset', res.headers.get('next-offset'));

            res = await fetch(url);

            plows.push(...(await res.json()).features);
        } while (res.headers.has('next-offset') && res.headers.get('next-offset') !== 'None')
        console.log(`ok - fetched ${plows.length} plows`);

        for (const plow of plows) {
            //console.error(plow);
        }
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    const task = new Task();
    task.control();
}


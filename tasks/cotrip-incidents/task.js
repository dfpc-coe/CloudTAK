import fs from 'fs';

try {
    const dotfile = new URL('.env', import.meta.url);

    fs.accessSync(dotfile);

    Object.assign(process.env, JSON.parse(fs.readFileSync(dotfile)));
    console.log('ok - .env file loaded');
} catch (err) {
    console.log('ok - no .env file loaded');
}

export default class Task {
    constructor() {
        this.token = process.env.COTRIP_TOKEN;
        this.api = 'https://data.cotrip.org/';
        this.etl = process.env.ETL_API;
        this.layer = process.env.ETL_LAYER;
        if (!this.token) throw new Error('No COTrip API Token Provided');
        if (!this.etl) throw new Error('No ETL API URL Provided');
        if (!this.layer) throw new Error('No ETL Layer Provided');
    }

    async control() {
        const incidents = [];
        let batch = -1;
        let res;
        do {
            console.error(`ok - fetching ${++batch} of incidents`);
            const url = new URL('/api/v1/snowPlows', this.api);
            url.searchParams.append('apiKey', this.token);
            if (res) url.searchParams.append('offset', res.headers.get('next-offset'));

            res = await fetch(url);

            incidents.push(...(await res.json()).features);
        } while (res.headers.has('next-offset') && res.headers.get('next-offset') !== 'None')
        console.log(`ok - fetched ${incidents.length} incidents`);

        const features = {
            type: 'FeatureCollection',
            features: incidents.map((plow) => {
                const feat = {
                    id: plow.avl_location.vehicle.id2,
                    type: 'Feature',
                    properties: {
                        type: 'a-f-G',
                        how: 'm-g',
                        callsign: `${plow.avl_location.vehicle.fleet} ${plow.avl_location.vehicle.type}`
                    },
                    geometry: {
                        type: 'Point',
                        coordinates: [
                            plow.avl_location.position.longitude,
                            plow.avl_location.position.latitude
                        ]
                    }
                };

                return feat;
            })
        };

        const post = await fetch(new URL(`/api/layer/${this.layer}/cot`, this.etl), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(features)
        });

        console.error(await post.json());
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    const task = new Task();
    task.control();
}


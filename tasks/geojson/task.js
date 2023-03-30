import { kml } from '@tmcw/togeojson';
import { DOMParser } from '@xmldom/xmldom';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import os from 'node:os';

try {
    const dotfile = new URL('.env', import.meta.url);

    fs.accessSync(dotfile);

    Object.assign(process.env, JSON.parse(fs.readFileSync(dotfile)));
    console.log('ok - .env file loaded');
} catch (err) {
    console.log('ok - no .env file loaded');
}

export default class Task {
    constructor(etl) {
        this.etl = { 
            api: process.env.ETL_API || '', 
            data: process.env.ETL_DATA || '', 
            token: process.env.ETL_TOKEN || '',
            task: process.env.ETL_TASK || '{}'
        };

        // This is just a helper function for local development, signing with the (unsecure) default secret
        if (!this.etl.token && (new URL(this.etl.api)).hostname === 'localhost') {
            this.etl.token = jwt.sign({ access: 'cot', layer: parseInt(this.etl.layer) }, 'coe-wildland-fire')
        }

        if (!this.etl.api) throw new Error('No ETL API URL Provided');
        if (!this.etl.layer) throw new Error('No ETL Layer Provided');
        if (!this.etl.token) throw new Error('No ETL Token Provided');
        if (!this.etl.task) throw new Error('No ETL Task Provided');

        this.etl.task = JSON.parse(this.etl.task);
    }

    async control() {
        const res = await fetch(new URL(`/api/data/${this.data}/asset/${this.etl.task.asset}`, this.etl.api));
        await pipeline(
            res.body.getReader(),
            fs.createWriteStream(path.resolve(os.tmpdir(), this.etl.task.asset))
        );

        let stream;
        if (this.etl.task.body.format === 'GeoJSON') {
            const kml = new KML(this.etl);
            stream = await kml.convert();
        }

        const form = new FormData();
        form.append('file', new File(stream, `${this.etl.task.asset}.ldgeojson`));

        const encoder = new FormDataEncoder(form)

        return Readable.from(encoder)
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    const task = new Task();
    task.control();
}

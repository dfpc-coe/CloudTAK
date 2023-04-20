import fetcher from './lib/fetch.js';
import csv from 'csv-parser';
import jwt from 'jsonwebtoken';
import fs from 'fs';

const SERVER = process.env.LDAP_SERVER || 'https://auth.cotak.gov/';
const USERNAME = process.env.LDAP_USERNAME;
const PASSWORD = process.env.LDAP_PASSWORD;

const API = process.env.TAK_STATS_API || 'http://localhost:4999';
const TOKEN = process.env.TAK_STATS_TOKEN || 'coe-wildland-fire';

export async function handler() {
    const csvpath = await fetcher(SERVER, USERNAME, PASSWORD);

    const types = ['businesscategory', 'o', 'ou', 'postalcode', 'title'];

    const stats = {
        count: 0
    };

    for (const type of types) {
        stats[type] = {};
    }

    return new Promise((resolve, reject) => {
        fs.createReadStream(csvpath.pathname)
            .pipe(csv({ columns: true, skip_empty_lines: true, delimiter: ',' }))
            .on('data', (data) => {
                ++stats.count;

                for (const type of types) {
                    if (!stats[type][data[type]]) stats[type][data[type]] = 0;
                    ++stats[type][data[type]];
                }
            })
            .on('end', async () => {
                for (const type of types) {
                    stats[type]['uncategorized'] = stats[type][''] || 0;
                    delete stats[type][''];
                }

                console.error(JSON.stringify(stats, null, 4));
                const record = await fetch(new URL('/api/record', API), {
                    method: 'POST',
                    headers: {
                        'content-type': 'application/json',
                        authorization: `bearer ${jwt.sign({ access: 'machine' }, TOKEN)}`
                    },
                    body: JSON.stringify(stats)
                });

                if (record.status !== 200) {
                    const text = await record.text();
                    return reject(new Error(text));
                } else {
                    console.error('ok - results posted');
                    return resolve();
                }
            });
    });
}

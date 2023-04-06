import test from 'tape';
import Flight from './flight.js';
import moment from 'moment';
import jwt from 'jsonwebtoken';

const flight = new Flight();

flight.init(test);
flight.takeoff(test);

test('POST: api/record - no auth', async (t) => {
    try {
        const res = await flight.fetch('/api/record', {
            method: 'POST',
            body: {
                count: 50,
                businesscategory: {
                    'SAR': 15,
                    uncategorized: 35
                },
                o: {
                    'Mesa SAR': 43,
                    uncategorized: 7
                },
                ou: {
                    'Ground Team': 5,
                    uncategorized: 45
                },
                title: {
                    tech: 4,
                    ground: 4,
                    uncategorized: 42
                },
                postalcode: {
                    uncategorized: 50
                }
            }
        }, false);

        t.equal(res.status, 403, 'http: 401');
        t.deepEqual(res.body, {
            status: 403,
            message: 'Authentication Required',
            messages: []
        });
    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});

const teams = {
    'Mesa County SAR': {
        type: 'SAR',
        percent: 0.50,
        positions: ['ops', 'ground', 'tech'],
        postalcode: ['81507', '81521']
    },
    'Larimer County SAR': {
        type: 'SAR',
        percent: 0.10,
        positions: ['ops', 'ground', 'tech'],
        postalcode: ['81507', '81521']
    },
    'Grand Junction PD': {
        type: 'LEO',
        percent: 0.20,
        positions: ['sgt', 'command', 'staff', 'dispatch'],
        postalcode: ['81507', '81521']
    },
    'Mesa County SO': {
        type: 'LEO',
        percent: 0.25,
        positions: ['sgt', 'command', 'rad'],
        postalcode: ['81507', '81521']
    },
    uncategorized: {
        type: 'uncategorized',
        percent: 0.05,
        positions: ['uncategorized'],
        postalcode: ['81507', '81521']
    }
};

test('POST: api/record - success', async (t) => {
    try {
        for (let i = 0; i < 30; i++) {
            const count = 500 - (i * 2) - Math.floor(Math.random() * 20);

            const body = {
                count,
                date: moment().add(i * -1, 'd').format('YYYY-MM-DD'),
                businesscategory: {},
                postalcode: {},
                o: {},
                ou: {},
                title: {}
            };
            for (const team of Object.keys(teams)) {
                body.o[team] = Math.round(count * teams[team].percent);

                if (!body.businesscategory[teams[team].type]) body.businesscategory[teams[team].type] = 0;
                body.businesscategory[teams[team].type] += Math.round(count * teams[team].percent);

                for (const title of teams[team].positions) {
                    body.title[title] = Math.round((count * teams[team].percent) * 1 / teams[team].positions.length);
                }
                for (const zip of teams[team].postalcode) {
                    body.postalcode[zip] = Math.round((count * teams[team].percent) * 1 / teams[team].postalcode.length);
                }
            }

            // TODO maybe populate subcategory some day
            body.ou.uncategorized = count;

            await flight.fetch('/api/record', {
                method: 'POST',
                auth: {
                    bearer: jwt.sign({ access: 'machine' }, 'coe-wildland-fire')
                },
                body
            }, true);
        }
    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});

flight.landing(test);

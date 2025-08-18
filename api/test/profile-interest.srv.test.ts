import test from 'tape';
import Flight from './flight.js';

const flight = new Flight();

flight.init();
flight.takeoff();
flight.user();

const time = new Date('2025-03-04T22:54:15.447Z').toISOString()

test('GET: api/profile/interest', async (t) => {
    try {
        const res = await flight.fetch('/api/profile/interest', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        t.deepEquals(res.body, {
            total: 0,
            items: []
        });
    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});

test('POST: api/profile/interest', async (t) => {
    try {
        const res = await flight.fetch('/api/profile/interest', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                name: 'Test AOI',
                bounds: [ -180, -90, 180, 90 ]
            }
        }, true);

        res.body.created = time;
        res.body.updated = time;

        t.deepEquals(res.body, {
            id: 1,
            name: 'Test AOI',
            username: 'admin@example.com',
            created: time,
            updated: time,
            bounds: {
                type: 'Polygon',
                coordinates: [[[-180, -90 ], [ 180, -90 ], [ 180, 90 ], [ -180, 90 ], [ -180, -90 ] ] ]
            }
        });
    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});

test('GET: api/profile/interest', async (t) => {
    try {
        const res = await flight.fetch('/api/profile/interest', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        res.body.items[0].created = time;
        res.body.items[0].updated = time;

        t.deepEquals(res.body, {
            total: 1,
            items: [{
                id: 1,
                name: 'Test AOI',
                username: 'admin@example.com',
                created: time,
                updated: time,
                bounds: {
                    type: 'Polygon',
                    coordinates: [[[-180, -90 ], [ 180, -90 ], [ 180, 90 ], [ -180, 90 ], [ -180, -90 ] ] ]
                }
            }]
        });
    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});

test('PATCH: api/profile/interest/1', async (t) => {
    try {
        const res = await flight.fetch('/api/profile/interest/1', {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                name: 'Test AOI Renamed',
            }
        }, true);

        res.body.created = time;
        res.body.updated = time;

        t.deepEquals(res.body, {
            id: 1,
            name: 'Test AOI Renamed',
            username: 'admin@example.com',
            created: time,
            updated: time,
            bounds: {
                type: 'Polygon',
                coordinates: [[[-180, -90 ], [ 180, -90 ], [ 180, 90 ], [ -180, 90 ], [ -180, -90 ] ] ]
            }
        });
    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});

test('GET: api/profile/interest', async (t) => {
    try {
        const res = await flight.fetch('/api/profile/interest', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        res.body.items[0].created = time;
        res.body.items[0].updated = time;

        t.deepEquals(res.body, {
            total: 1,
            items: [{
                id: 1,
                name: 'Test AOI Renamed',
                username: 'admin@example.com',
                created: time,
                updated: time,
                bounds: {
                    type: 'Polygon',
                    coordinates: [[[-180, -90 ], [ 180, -90 ], [ 180, 90 ], [ -180, 90 ], [ -180, -90 ] ] ]
                }
            }]
        });
    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});

test('DELETE: api/profile/interest/1', async (t) => {
    try {
        const res = await flight.fetch('/api/profile/interest/1', {
            method: 'DELETE',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        t.deepEquals(res.body, {
            status: 200,
            message: 'Interest Area Deleted'
        });
    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});

test('GET: api/profile/interest', async (t) => {
    try {
        const res = await flight.fetch('/api/profile/interest', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        t.deepEquals(res.body, {
            total: 0,
            items: []
        });
    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});

flight.landing();

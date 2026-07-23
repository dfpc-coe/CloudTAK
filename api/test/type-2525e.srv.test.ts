import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';

const flight = new Flight();

flight.init({ takserver: true });
flight.takeoff();
flight.user();

test('GET: api/type/2525e', async () => {
    try {
        const res = await flight.fetch('/api/type/2525e?limit=2', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.ok(res.body.total > 0);
        assert.ok(res.body.symbolsets.length > 0);

        const ids = res.body.symbolsets.map((set: { id: string }) => set.id);
        assert.deepEqual(ids, [...ids].sort(), 'symbolsets are sorted by id');

        assert.deepEqual(res.body.symbolsets.find((set: { id: string }) => set.id === '10'), {
            id: '10',
            name: 'Land unit',
        });

        assert.equal(res.body.items.length, 2);

        for (const item of res.body.items) {
            assert.match(item.sidc, /^\d{20}$/);
            assert.equal(typeof item.name, 'string');
            assert.equal(typeof item.title, 'string');
            assert.equal(typeof item.remarks, 'string');
            assert.match(item.symbolset, /^\d{2}$/);
            assert.equal(typeof item.children, 'number');
        }
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/type/2525e - filter', async () => {
    try {
        const res = await flight.fetch('/api/type/2525e?filter=vandalism', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.deepEqual(res.body.items, [{
            sidc: '13034000001101140000',
            name: 'Incident - Criminal Activity Incident - Vandalism/Loot/Ransack/Plunder',
            title: 'Vandalism/Loot/Ransack/Plunder',
            remarks: '',
            symbolset: '40',
            children: 0,
        }]);

        assert.equal(res.body.total, 1);
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/type/2525e - identity', async () => {
    try {
        const res = await flight.fetch('/api/type/2525e?filter=vandalism&identity=h', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.equal(res.body.items[0].sidc, '13064000001101140000');
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/type/2525e - symbolset returns top-level Entities', async () => {
    try {
        const res = await flight.fetch('/api/type/2525e?symbolset=27&limit=100', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.ok(res.body.total > 0);

        for (const item of res.body.items) {
            assert.equal(item.symbolset, '27');
            assert.ok(item.sidc.substring(10, 16).endsWith('0000'), 'Entity Code only');
        }
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/type/2525e - parent lists Entity Types', async () => {
    try {
        const res = await flight.fetch('/api/type/2525e?symbolset=10&parent=110000&limit=100', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.equal(res.body.total, 15);

        for (const item of res.body.items) {
            const entity = item.sidc.substring(10, 16);
            assert.ok(entity.startsWith('11') && entity.endsWith('00') && entity !== '110000');
        }

        assert.deepEqual(res.body.items[0], {
            sidc: '13031000001101000000',
            name: 'Command and Control - Broadcast Transmitter Antennae',
            title: 'Broadcast Transmitter Antennae',
            remarks: '',
            symbolset: '10',
            children: 0,
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/type/2525e - parent lists Entity Subtypes', async () => {
    try {
        const res = await flight.fetch('/api/type/2525e?symbolset=40&parent=110100&limit=100', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.ok(res.body.total > 0);

        for (const item of res.body.items) {
            const entity = item.sidc.substring(10, 16);
            assert.ok(entity.startsWith('1101') && !entity.endsWith('00'));
        }

        const vandalism = res.body.items.find((item: { title: string }) => item.title === 'Vandalism/Loot/Ransack/Plunder');
        assert.equal(vandalism.sidc, '13034000001101140000');
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/type/2525e - parent requires symbolset', async () => {
    try {
        const res = await flight.fetch('/api/type/2525e?parent=110000', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, false);

        assert.equal(res.status, 400, 'http: 400');
        assert.equal(res.body.message, 'parent requires symbolset to be set');
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/type/2525e/:sidc', async () => {
    try {
        const res = await flight.fetch('/api/type/2525e/13034000001101140000', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.deepEqual(res.body, {
            sidc: '13034000001101140000',
            name: 'Incident - Criminal Activity Incident - Vandalism/Loot/Ransack/Plunder',
            remarks: '',
            symbolset: '40',
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/type/2525e/:sidc - unknown entity', async () => {
    try {
        const res = await flight.fetch('/api/type/2525e/13034000009999990000', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.deepEqual(res.body, {
            sidc: '13034000009999990000',
            name: 'Unknown 2525 Symbol',
            remarks: '',
            symbolset: '40',
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/type/2525e/:sidc - invalid SIDC', async () => {
    try {
        const res = await flight.fetch('/api/type/2525e/a-f-G', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, false);

        assert.equal(res.status, 400, 'http: 400');
        assert.equal(res.body.message, 'Invalid 2525D/2525E Numeric SIDC');
    } catch (err) {
        assert.ifError(err);
    }
});

flight.landing();

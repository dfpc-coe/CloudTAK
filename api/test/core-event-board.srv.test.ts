import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';

const flight = new Flight();

flight.init({ takserver: true });
flight.takeoff();
flight.user();
flight.user({ username: 'user', admin: false });

let nominatedId: string;
let customId: string;
let eventId: string;
let unsharedEventId: string;

test('GET: api/core/event/board - auto-creates Nominated board', async () => {
    try {
        const res = await flight.fetch('/api/core/event/board?channel=7', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.equal(res.body.total, 1);
        assert.equal(res.body.items.length, 1);

        const board = res.body.items[0];
        assert.ok(board.id, 'has id');
        nominatedId = board.id;
        assert.ok(board.created, 'has created');
        assert.ok(board.updated, 'has updated');
        delete board.id;
        delete board.created;
        delete board.updated;

        assert.deepEqual(board, {
            channel: 7,
            name: 'Nominated',
            description: '',
            color: '',
            type: 'nominated',
            position: 0,
            events: [],
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/core/event/board - Nominated board is not duplicated', async () => {
    try {
        const res = await flight.fetch('/api/core/event/board?channel=7', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.equal(res.body.total, 1);
        assert.equal(res.body.items[0].id, nominatedId);
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/core/event/board - 403 without the channel active', async () => {
    try {
        const res = await flight.fetch('/api/core/event/board?channel=7', {
            method: 'GET',
            auth: {
                bearer: flight.token.user,
            },
        }, false);

        assert.equal(res.status, 403);
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/core/event/board', async () => {
    try {
        const res = await flight.fetch('/api/core/event/board', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                channel: 7,
                name: 'In Progress',
                description: 'Actively worked Events',
                color: '#f76707',
            },
        }, true);

        assert.ok(res.body.id, 'has id');
        customId = res.body.id;
        delete res.body.id;
        delete res.body.created;
        delete res.body.updated;

        assert.deepEqual(res.body, {
            channel: 7,
            name: 'In Progress',
            description: 'Actively worked Events',
            color: '#f76707',
            type: 'custom',
            position: 1,
            events: [],
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('PATCH: api/core/event/board/:board - rename Nominated board', async () => {
    try {
        const res = await flight.fetch(`/api/core/event/board/${nominatedId}`, {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                name: 'Triage',
                description: 'Newly nominated Events',
                color: '#0054a6',
            },
        }, true);

        assert.equal(res.body.name, 'Triage');
        assert.equal(res.body.description, 'Newly nominated Events');
        assert.equal(res.body.color, '#0054a6');
        assert.equal(res.body.type, 'nominated');
    } catch (err) {
        assert.ifError(err);
    }
});

test('PUT: api/core/event/board/:board/event/:event - nominate Event', async () => {
    try {
        const event = await flight.fetch('/api/core/event', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                name: 'Wildfire Report',
                type: '10031000001213000000',
                geometry: {
                    type: 'Point',
                    coordinates: [-105.2705, 40.015],
                },
                channels: [7],
            },
        }, true);

        eventId = event.body.id;

        const res = await flight.fetch(`/api/core/event/board/${nominatedId}/event/${eventId}`, {
            method: 'PUT',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                position: 0,
            },
        }, true);

        assert.equal(res.body.board, nominatedId);
        assert.equal(res.body.channel, 7);
        assert.equal(res.body.position, 0);
        assert.equal(res.body.event.id, eventId);
        assert.equal(res.body.event.name, 'Wildfire Report');
    } catch (err) {
        assert.ifError(err);
    }
});

test('PUT: api/core/event/board/:board/event/:event - 400 for unshared Event', async () => {
    try {
        const event = await flight.fetch('/api/core/event', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                name: 'Other Channel Event',
                type: '10031000001213000000',
                geometry: {
                    type: 'Point',
                    coordinates: [-105.2705, 40.015],
                },
                channels: [9],
            },
        }, true);

        unsharedEventId = event.body.id;

        const res = await flight.fetch(`/api/core/event/board/${nominatedId}/event/${unsharedEventId}`, {
            method: 'PUT',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                position: 0,
            },
        }, false);

        assert.equal(res.status, 400);
    } catch (err) {
        assert.ifError(err);
    }
});

test('PUT: api/core/event/board/:board/event/:event - move Event between boards', async () => {
    try {
        const res = await flight.fetch(`/api/core/event/board/${customId}/event/${eventId}`, {
            method: 'PUT',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                position: 0,
            },
        }, true);

        assert.equal(res.body.board, customId);

        const list = await flight.fetch('/api/core/event/board?channel=7', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        const nominated = list.body.items.find((b: { id: string }) => b.id === nominatedId);
        const custom = list.body.items.find((b: { id: string }) => b.id === customId);

        assert.equal(nominated.events.length, 0);
        assert.equal(custom.events.length, 1);
        assert.equal(custom.events[0].event.id, eventId);
    } catch (err) {
        assert.ifError(err);
    }
});

test('DELETE: api/core/event/board/:board - Nominated board cannot be deleted', async () => {
    try {
        const res = await flight.fetch(`/api/core/event/board/${nominatedId}`, {
            method: 'DELETE',
            auth: {
                bearer: flight.token.admin,
            },
        }, false);

        assert.equal(res.status, 400);
    } catch (err) {
        assert.ifError(err);
    }
});

test('DELETE: api/core/event/board/:board - custom board', async () => {
    try {
        const res = await flight.fetch(`/api/core/event/board/${customId}`, {
            method: 'DELETE',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.deepEqual(res.body, { status: 200, message: 'Board Deleted' });

        // Placements on the deleted Board are removed but the Event survives
        const list = await flight.fetch('/api/core/event/board?channel=7', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.equal(list.body.total, 1);
        assert.equal(list.body.items[0].id, nominatedId);
        assert.equal(list.body.items[0].events.length, 0);

        const event = await flight.fetch(`/api/core/event/${eventId}`, {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.equal(event.body.id, eventId);
    } catch (err) {
        assert.ifError(err);
    }
});

test('DELETE: api/core/event/board/:board/event/:event - remove placement', async () => {
    try {
        await flight.fetch(`/api/core/event/board/${nominatedId}/event/${eventId}`, {
            method: 'PUT',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                position: 0,
            },
        }, true);

        const res = await flight.fetch(`/api/core/event/board/${nominatedId}/event/${eventId}`, {
            method: 'DELETE',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.deepEqual(res.body, { status: 200, message: 'Event removed from Board' });

        const list = await flight.fetch('/api/core/event/board?channel=7', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.equal(list.body.items[0].events.length, 0);
    } catch (err) {
        assert.ifError(err);
    }
});

flight.landing();

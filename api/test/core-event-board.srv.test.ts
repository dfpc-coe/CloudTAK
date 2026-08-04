import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';

const flight = new Flight();

flight.init({ takserver: true });
flight.takeoff();
flight.user();
flight.user({ username: 'user', admin: false });

let boardId: string;
let secondBoardId: string;
let nominatedId: string;
let customId: string;
let eventId: string;
let unsharedEventId: string;
let placementId: string;

test('GET: api/board - auto-creates the Channel Board', async () => {
    try {
        const res = await flight.fetch('/api/board?channel=7', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.equal(res.body.total, 1);
        assert.equal(res.body.items.length, 1);

        const board = res.body.items[0];
        assert.ok(board.id, 'has id');
        boardId = board.id;
        assert.ok(board.created, 'has created');
        assert.ok(board.updated, 'has updated');
        delete board.id;
        delete board.created;
        delete board.updated;

        assert.deepEqual(board, {
            channel: 7,
            name: 'Events',
            description: '',
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/board - the Channel Board is not duplicated', async () => {
    try {
        const res = await flight.fetch('/api/board?channel=7', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.equal(res.body.total, 1);
        assert.equal(res.body.items[0].id, boardId);
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/board - 403 without the channel active', async () => {
    try {
        const res = await flight.fetch('/api/board?channel=7', {
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

test('GET: api/board/:board', async () => {
    try {
        const res = await flight.fetch(`/api/board/${boardId}`, {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.equal(res.body.id, boardId);
        assert.equal(res.body.channel, 7);
        assert.equal(res.body.name, 'Events');
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/board/column - auto-creates the Nominated Column', async () => {
    try {
        const res = await flight.fetch(`/api/board/column?board=${boardId}`, {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.equal(res.body.total, 1);

        const column = res.body.items[0];
        assert.ok(column.id, 'has id');
        nominatedId = column.id;
        assert.ok(column.created, 'has created');
        assert.ok(column.updated, 'has updated');
        delete column.id;
        delete column.created;
        delete column.updated;

        assert.deepEqual(column, {
            board: boardId,
            name: 'Nominated',
            description: '',
            color: '',
            type: 'nominated',
            position: 0,
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/board', async () => {
    try {
        const res = await flight.fetch('/api/board', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                channel: 7,
                name: 'Planning',
                description: 'Longer horizon Events',
            },
        }, true);

        assert.ok(res.body.id, 'has id');
        secondBoardId = res.body.id;
        assert.equal(res.body.channel, 7);
        assert.equal(res.body.name, 'Planning');
        assert.equal(res.body.description, 'Longer horizon Events');

        // A new Board gets its own Nominated Column
        const columns = await flight.fetch(`/api/board/column?board=${secondBoardId}`, {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.equal(columns.body.total, 1);
        assert.equal(columns.body.items[0].type, 'nominated');
    } catch (err) {
        assert.ifError(err);
    }
});

test('PATCH: api/board/:board', async () => {
    try {
        const res = await flight.fetch(`/api/board/${secondBoardId}`, {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                name: 'Long Range Planning',
            },
        }, true);

        assert.equal(res.body.name, 'Long Range Planning');
        assert.equal(res.body.description, 'Longer horizon Events');
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/board/column', async () => {
    try {
        const res = await flight.fetch('/api/board/column', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                board: boardId,
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
            board: boardId,
            name: 'In Progress',
            description: 'Actively worked Events',
            color: '#f76707',
            type: 'custom',
            position: 1,
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('PATCH: api/board/column/:column - rename the Nominated Column', async () => {
    try {
        const res = await flight.fetch(`/api/board/column/${nominatedId}`, {
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

test('PUT: api/board/event - nominate Event', async () => {
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

        const res = await flight.fetch('/api/board/event', {
            method: 'PUT',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                column: nominatedId,
                event: eventId,
                position: 0,
            },
        }, true);

        assert.ok(res.body.id, 'has id');
        placementId = res.body.id;
        assert.equal(res.body.board, boardId);
        assert.equal(res.body.column, nominatedId);
        assert.equal(res.body.position, 0);
        assert.equal(res.body.event.id, eventId);
        assert.equal(res.body.event.name, 'Wildfire Report');
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/core/event/:event - reports the Boards & placement', async () => {
    try {
        const res = await flight.fetch(`/api/core/event/${eventId}`, {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.equal(res.body.boards.length, 2);

        const board = res.body.boards.find((b: { id: string }) => b.id === boardId);
        const second = res.body.boards.find((b: { id: string }) => b.id === secondBoardId);

        assert.equal(board.name, 'Events');
        assert.equal(board.channel, 7);
        assert.equal(board.column, nominatedId);
        assert.equal(board.columns.length, 2);

        assert.deepEqual(
            board.columns.map((c: { name: string }) => c.name),
            ['Triage', 'In Progress'],
        );

        // The Event isn't on the second Board of the Channel
        assert.equal(second.column, null);
        assert.equal(second.columns.length, 1);
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/board/event', async () => {
    try {
        const res = await flight.fetch(`/api/board/event?board=${boardId}`, {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.equal(res.body.total, 1);
        assert.equal(res.body.items[0].id, placementId);
        assert.equal(res.body.items[0].column, nominatedId);
        assert.equal(res.body.items[0].event.id, eventId);

        const filtered = await flight.fetch(`/api/board/event?board=${boardId}&column=${customId}`, {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.equal(filtered.body.total, 0);
    } catch (err) {
        assert.ifError(err);
    }
});

test('PUT: api/board/event - 400 for unshared Event', async () => {
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

        const res = await flight.fetch('/api/board/event', {
            method: 'PUT',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                column: nominatedId,
                event: unsharedEventId,
                position: 0,
            },
        }, false);

        assert.equal(res.status, 400);
    } catch (err) {
        assert.ifError(err);
    }
});

test('PATCH: api/board/event/:placement - move between Columns', async () => {
    try {
        const res = await flight.fetch(`/api/board/event/${placementId}`, {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                column: customId,
                position: 2,
            },
        }, true);

        assert.equal(res.body.column, customId);
        assert.equal(res.body.position, 2);

        const list = await flight.fetch(`/api/board/event?board=${boardId}&column=${customId}`, {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.equal(list.body.total, 1);
        assert.equal(list.body.items[0].event.id, eventId);
    } catch (err) {
        assert.ifError(err);
    }
});

test('PATCH: api/board/event/:placement - 400 for a Column of another Board', async () => {
    try {
        const columns = await flight.fetch(`/api/board/column?board=${secondBoardId}`, {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        const res = await flight.fetch(`/api/board/event/${placementId}`, {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                column: columns.body.items[0].id,
            },
        }, false);

        assert.equal(res.status, 400);
    } catch (err) {
        assert.ifError(err);
    }
});

test('PUT: api/board/event - re-placing keeps a single placement per Board', async () => {
    try {
        const res = await flight.fetch('/api/board/event', {
            method: 'PUT',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                column: nominatedId,
                event: eventId,
                position: 0,
            },
        }, true);

        assert.equal(res.body.id, placementId);
        assert.equal(res.body.column, nominatedId);

        const list = await flight.fetch(`/api/board/event?board=${boardId}`, {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.equal(list.body.total, 1);
    } catch (err) {
        assert.ifError(err);
    }
});

test('DELETE: api/board/column/:column - the Nominated Column cannot be deleted', async () => {
    try {
        const res = await flight.fetch(`/api/board/column/${nominatedId}`, {
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

test('DELETE: api/board/column/:column - custom Column', async () => {
    try {
        const res = await flight.fetch(`/api/board/column/${customId}`, {
            method: 'DELETE',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.deepEqual(res.body, { status: 200, message: 'Column Deleted' });

        const columns = await flight.fetch(`/api/board/column?board=${boardId}`, {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.equal(columns.body.total, 1);
        assert.equal(columns.body.items[0].id, nominatedId);
    } catch (err) {
        assert.ifError(err);
    }
});

test('DELETE: api/board/event/:placement - remove placement', async () => {
    try {
        const res = await flight.fetch(`/api/board/event/${placementId}`, {
            method: 'DELETE',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.deepEqual(res.body, { status: 200, message: 'Event removed from Board' });

        const list = await flight.fetch(`/api/board/event?board=${boardId}`, {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.equal(list.body.total, 0);

        // Removing the placement leaves the Event itself alone
        const event = await flight.fetch(`/api/core/event/${eventId}`, {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.equal(event.body.id, eventId);
        assert.equal(event.body.boards.length, 2);
        assert.equal(event.body.boards.every((b: { column: string | null }) => b.column === null), true);
    } catch (err) {
        assert.ifError(err);
    }
});

test('DELETE: api/board/:board - custom Board', async () => {
    try {
        const res = await flight.fetch(`/api/board/${secondBoardId}`, {
            method: 'DELETE',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.deepEqual(res.body, { status: 200, message: 'Board Deleted' });

        const list = await flight.fetch('/api/board?channel=7', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.equal(list.body.total, 1);
        assert.equal(list.body.items[0].id, boardId);
    } catch (err) {
        assert.ifError(err);
    }
});

test('DELETE: api/board/:board - the last Board of a Channel cannot be deleted', async () => {
    try {
        const res = await flight.fetch(`/api/board/${boardId}`, {
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

test('GET: api/core/event/:event - no Boards for an unshared Channel', async () => {
    try {
        const res = await flight.fetch(`/api/core/event/${unsharedEventId}`, {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.deepEqual(res.body.boards, []);
    } catch (err) {
        assert.ifError(err);
    }
});

flight.landing();

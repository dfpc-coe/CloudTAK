import test from 'tape';
import Flight from './flight.js';

const flight = new Flight();

flight.init();
flight.takeoff();
flight.user();

let templateId: string;

test('GET: api/template/mission - Empty', async (t) => {
    try {
        const res = await flight.fetch('/api/template/mission', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, false);

        t.deepEquals(res.body, {
            total: 0,
            items: []
        });
    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});

test('POST: api/template/mission', async (t) => {
    try {
        const res = await flight.fetch('/api/template/mission', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                name: 'Test Template',
                icon: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
                description: 'A test mission template'
            }
        }, false);

        t.ok(res.body.created, 'has created date');
        t.ok(res.body.updated, 'has updated date');
        t.ok(res.body.id, 'has id');
        templateId = res.body.id;

        delete res.body.created;
        delete res.body.updated;
        delete res.body.id;

        t.deepEquals(res.body, {
            name: 'Test Template',
            icon: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
            description: 'A test mission template'
        });
    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});

test('GET: api/template/mission - List', async (t) => {
    try {
        const res = await flight.fetch('/api/template/mission', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, false);

        t.equals(res.body.total, 1);
        t.equals(res.body.items.length, 1);
        t.equals(res.body.items[0].name, 'Test Template');
        t.equals(res.body.items[0].id, templateId);
    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});

test('GET: api/template/mission/:id', async (t) => {
    try {
        const res = await flight.fetch(`/api/template/mission/${templateId}`, {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, false);

        t.ok(res.body.created, 'has created date');
        t.ok(res.body.updated, 'has updated date');
        t.equals(res.body.id, templateId);

        delete res.body.created;
        delete res.body.updated;
        delete res.body.id;

        t.deepEquals(res.body, {
            name: 'Test Template',
            icon: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
            description: 'A test mission template'
        });
    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});

test('PATCH: api/template/mission/:id', async (t) => {
    try {
        const res = await flight.fetch(`/api/template/mission/${templateId}`, {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                description: 'Updated description'
            }
        }, false);

        t.ok(res.body.created, 'has created date');
        t.ok(res.body.updated, 'has updated date');
        t.equals(res.body.id, templateId);

        delete res.body.created;
        delete res.body.updated;
        delete res.body.id;

        t.deepEquals(res.body, {
            name: 'Test Template',
            icon: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
            description: 'Updated description'
        });
    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});

test('DELETE: api/template/mission/:id', async (t) => {
    try {
        const res = await flight.fetch(`/api/template/mission/${templateId}`, {
            method: 'DELETE',
            auth: {
                bearer: flight.token.admin
            }
        }, false);

        t.deepEquals(res.body, {
            status: 200,
            message: 'Mission Template Deleted'
        });
    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});

test('GET: api/template/mission/:id - 404', async (t) => {
    try {
        const res = await flight.fetch(`/api/template/mission/${templateId}`, {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, false);

        t.equals(res.status, 404);
    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});

flight.landing();

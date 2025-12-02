import test from 'tape';
import Flight from './flight.js';

const flight = new Flight();

flight.init();
flight.takeoff();
flight.user();

const validIcon = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

test('GET: /template/mission - empty', async (t) => {
    try {
        const res = await flight.fetch('/api/template/mission', {
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

let templateId: string;

test('POST: /template/mission - create', async (t) => {
    try {
        const res = await flight.fetch('/api/template/mission', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                name: 'Test Template',
                description: 'A test mission template',
                icon: validIcon
            }
        }, true);

        t.ok(res.body.id, 'returned an id');
        t.equals(res.body.name, 'Test Template');
        t.equals(res.body.description, 'A test mission template');
        t.equals(res.body.icon, validIcon);
        t.ok(res.body.created, 'returned a created date');
        t.ok(res.body.updated, 'returned an updated date');

        templateId = res.body.id;
    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});

test('GET: /template/mission - list', async (t) => {
    try {
        const res = await flight.fetch('/api/template/mission', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        t.equals(res.body.total, 1);
        t.equals(res.body.items.length, 1);
        t.equals(res.body.items[0].id, templateId);
        t.equals(res.body.items[0].name, 'Test Template');
    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});

test('GET: /template/mission/:mission - get', async (t) => {
    try {
        const res = await flight.fetch(`/api/template/mission/${templateId}`, {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        t.equals(res.body.id, templateId);
        t.equals(res.body.name, 'Test Template');
        t.equals(res.body.description, 'A test mission template');
        t.equals(res.body.icon, validIcon);
    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});

test('PATCH: /template/mission/:mission - update', async (t) => {
    try {
        const res = await flight.fetch(`/api/template/mission/${templateId}`, {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                name: 'Updated Template',
                description: 'An updated description'
            }
        }, true);

        t.equals(res.body.id, templateId);
        t.equals(res.body.name, 'Updated Template');
        t.equals(res.body.description, 'An updated description');
        t.equals(res.body.icon, validIcon);
    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});

test('DELETE: /template/mission/:mission - delete', async (t) => {
    try {
        const res = await flight.fetch(`/api/template/mission/${templateId}`, {
            method: 'DELETE',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        t.equals(res.body.status, 200);
        t.equals(res.body.message, 'Mission Template Deleted');
    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});

test('GET: /template/mission/:mission - not found', async (t) => {
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

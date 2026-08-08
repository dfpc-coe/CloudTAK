import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';

const flight = new Flight();

flight.init({ takserver: true });
flight.takeoff();
flight.user();

const validIcon = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

let templateId: string;
let featureId: string;

test('POST: /template/mission - create parent template', async () => {
    try {
        const res = await flight.fetch('/api/template/mission', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                name: 'Parent Template',
                description: 'Parent template for palette features',
                icon: validIcon,
            },
        }, true);

        templateId = res.body.id;
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: /template/mission/:mission/palette - empty', async () => {
    try {
        const res = await flight.fetch(`/api/template/mission/${templateId}/palette`, {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.deepEqual(res.body, {
            total: 0,
            items: [],
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: /template/mission/:mission/palette - create', async () => {
    try {
        const res = await flight.fetch(`/api/template/mission/${templateId}/palette`, {
            method: 'POST',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                name: 'Test Feature',
                type: 'Point',
                style: {},
            },
        }, true);

        assert.ok(res.body.uuid, 'returned a uuid');
        assert.equal(res.body.name, 'Test Feature');
        assert.equal(res.body.template, templateId);

        featureId = res.body.uuid;
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: /template/mission/:mission/palette/:feature - get', async () => {
    try {
        const res = await flight.fetch(`/api/template/mission/${templateId}/palette/${featureId}`, {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.equal(res.body.uuid, featureId);
        assert.equal(res.body.name, 'Test Feature');
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: /template/mission/:mission/palette - list', async () => {
    try {
        const res = await flight.fetch(`/api/template/mission/${templateId}/palette`, {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.equal(res.body.total, 1);
        assert.equal(res.body.items.length, 1);
    } catch (err) {
        assert.ifError(err);
    }
});

test('PATCH: /template/mission/:mission/palette/:feature - update', async () => {
    try {
        const res = await flight.fetch(`/api/template/mission/${templateId}/palette/${featureId}`, {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                name: 'Updated Feature',
            },
        }, true);

        assert.equal(res.body.name, 'Updated Feature');
    } catch (err) {
        assert.ifError(err);
    }
});

test('DELETE: /template/mission/:mission/palette/:feature - delete', async () => {
    try {
        const res = await flight.fetch(`/api/template/mission/${templateId}/palette/${featureId}`, {
            method: 'DELETE',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.deepEqual(res.body, { status: 200, message: 'Palette Feature Deleted' });
    } catch (err) {
        assert.ifError(err);
    }
});

flight.landing();

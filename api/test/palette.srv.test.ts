import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';

const flight = new Flight();

flight.init({ takserver: true });
flight.takeoff();
flight.user();

const validIcon = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

let templateId: string;
let paletteId: string;
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
                description: 'Parent template for palettes',
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
                name: 'Test Palette',
            },
        }, true);

        assert.ok(res.body.uuid, 'returned a uuid');
        assert.equal(res.body.name, 'Test Palette');
        assert.equal(res.body.template, templateId);

        paletteId = res.body.uuid;
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: /template/mission/:mission/palette/:palette - get', async () => {
    try {
        const res = await flight.fetch(`/api/template/mission/${templateId}/palette/${paletteId}`, {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.equal(res.body.uuid, paletteId);
        assert.equal(res.body.name, 'Test Palette');
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: /template/mission/:mission/palette/:palette/feature - create', async () => {
    try {
        const res = await flight.fetch(`/api/template/mission/${templateId}/palette/${paletteId}/feature`, {
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
        assert.equal(res.body.palette, paletteId);

        featureId = res.body.uuid;
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: /template/mission/:mission/palette/:palette/feature - list', async () => {
    try {
        const res = await flight.fetch(`/api/template/mission/${templateId}/palette/${paletteId}/feature`, {
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

test('PATCH: /template/mission/:mission/palette/:palette/feature/:feature - update', async () => {
    try {
        const res = await flight.fetch(`/api/template/mission/${templateId}/palette/${paletteId}/feature/${featureId}`, {
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

test('DELETE: /template/mission/:mission/palette/:palette/feature/:feature - delete', async () => {
    try {
        const res = await flight.fetch(`/api/template/mission/${templateId}/palette/${paletteId}/feature/${featureId}`, {
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

test('DELETE: /template/mission/:mission/palette/:palette - delete', async () => {
    try {
        const res = await flight.fetch(`/api/template/mission/${templateId}/palette/${paletteId}`, {
            method: 'DELETE',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.deepEqual(res.body, { status: 200, message: 'Palette Deleted' });
    } catch (err) {
        assert.ifError(err);
    }
});

flight.landing();

import fs from 'fs';
import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';

const flight = new Flight();

flight.init();
flight.takeoff();

const UPDATE = process.env.UPDATE;

test('GET: api/schema', async () => {
    try {
        const res = await flight.fetch('/api/schema', {
            method: 'GET'
        }, true);

        const fixture = new URL('./fixtures/get_schema.json', import.meta.url);

        if (UPDATE) {
            fs.writeFileSync(fixture, JSON.stringify(res.body, null, 4));
        }

        assert.deepEqual(res.body, JSON.parse(String(fs.readFileSync(fixture))));
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/schema?method=FAKE', async () => {
    try {
        const res = await flight.fetch('/api/schema?method=fake', {
            method: 'GET'
        }, false);

        assert.equal(res.status, 400, 'http: 400');

        assert.deepEqual(res.body, {"status":400,"message":"Validation Error","messages":[{"type":"Query","errors":[{"instancePath":"/method","schemaPath":"#/properties/method/anyOf/0/const","keyword":"const","params":{"allowedValue":"GET"},"message":"must be equal to constant"},{"instancePath":"/method","schemaPath":"#/properties/method/anyOf/1/const","keyword":"const","params":{"allowedValue":"PUT"},"message":"must be equal to constant"},{"instancePath":"/method","schemaPath":"#/properties/method/anyOf/2/const","keyword":"const","params":{"allowedValue":"POST"},"message":"must be equal to constant"},{"instancePath":"/method","schemaPath":"#/properties/method/anyOf/3/const","keyword":"const","params":{"allowedValue":"DELETE"},"message":"must be equal to constant"},{"instancePath":"/method","schemaPath":"#/properties/method/anyOf/4/const","keyword":"const","params":{"allowedValue":"OPTIONS"},"message":"must be equal to constant"},{"instancePath":"/method","schemaPath":"#/properties/method/anyOf/5/const","keyword":"const","params":{"allowedValue":"HEAD"},"message":"must be equal to constant"},{"instancePath":"/method","schemaPath":"#/properties/method/anyOf/6/const","keyword":"const","params":{"allowedValue":"PATCH"},"message":"must be equal to constant"},{"instancePath":"/method","schemaPath":"#/properties/method/anyOf/7/const","keyword":"const","params":{"allowedValue":"TRACE"},"message":"must be equal to constant"},{"instancePath":"/method","schemaPath":"#/properties/method/anyOf","keyword":"anyOf","params":{},"message":"must match a schema in anyOf"}]}]});
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/schema?method=GET', async () => {
    try {
        const res = await flight.fetch('/api/schema?method=GET', {
            method: 'GET'
        }, false);

        assert.equal(res.status, 400, 'http: 400');
        assert.deepEqual(res.body, {
            status: 400,
            message: 'url & method params must be used together',
            messages: []
        });

    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/schema?url=123', async () => {
    try {
        const res = await flight.fetch('/api/schema?url=123', {
            method: 'GET'
        }, false);

        assert.equal(res.status, 400, 'http: 400');
        assert.deepEqual(res.body, {
            status: 400,
            message: 'url & method params must be used together',
            messages: []
        });
    } catch (err) {
        assert.ifError(err);
    }
});

flight.landing();

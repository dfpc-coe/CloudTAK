process.env.SigningSecret = 'coe-wildland-fire';
import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';
import type { IncomingMessage, ServerResponse } from 'node:http'

const flight = new Flight();

flight.init({ takserver: true });
flight.takeoff();
flight.user({ username: 'admin', admin: true });

test('GET: api/marti/clients - comma separated groups forwarded as repeated group params', async () => {
    flight.tak.mockMarti.push(async (request: IncomingMessage, response: ServerResponse) => {
        if (!request.method || !request.url) return false;

        const url = new URL(request.url, 'http://localhost');

        if (request.method === 'GET' && url.pathname === '/Marti/api/clientEndPoints') {
            assert.equal(url.searchParams.getAll('group').length, 2);
            assert.deepEqual(url.searchParams.getAll('group'), ['group-a', 'group-b']);
            assert.equal(url.searchParams.get('groups'), null);

            response.setHeader('Content-Type', 'application/json');
            response.write(JSON.stringify({
                version: '3',
                type: 'com.bbn.marti.remote.ClientEndpoint',
                data: []
            }));
            response.end();
            return true;
        }

        return false;
    });

    try {
        const res = await flight.fetch('/api/marti/clients?groups=group-a,group-b', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        assert.equal(res.status, 200);
        assert.deepEqual(res.body.data, []);
    } catch (err) {
        assert.ifError(err);
    }

    flight.tak.reset();
});

test('GET: api/marti/clients - single groups filter forwards a single group param', async () => {
    flight.tak.mockMarti.push(async (request: IncomingMessage, response: ServerResponse) => {
        if (!request.method || !request.url) return false;

        const url = new URL(request.url, 'http://localhost');

        if (request.method === 'GET' && url.pathname === '/Marti/api/clientEndPoints') {
            assert.deepEqual(url.searchParams.getAll('group'), ['group-a']);
            assert.equal(url.searchParams.get('groups'), null);

            response.setHeader('Content-Type', 'application/json');
            response.write(JSON.stringify({
                version: '3',
                type: 'com.bbn.marti.remote.ClientEndpoint',
                data: []
            }));
            response.end();
            return true;
        }

        return false;
    });

    try {
        const res = await flight.fetch('/api/marti/clients?groups=group-a', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        assert.equal(res.status, 200);
        assert.deepEqual(res.body.data, []);
    } catch (err) {
        assert.ifError(err);
    }

    flight.tak.reset();
});

flight.landing();

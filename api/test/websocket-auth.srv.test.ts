import test from 'node:test';
import assert from 'node:assert';
import ws from 'ws';
import Flight from './flight.js';

const flight = new Flight();

flight.init({ takserver: true });
flight.takeoff();
flight.user();

// A rejected upgrade surfaces as 'unexpected-response' with the HTTP status
// code; an accepted socket fires 'open'
function attempt(url: URL): Promise<{ outcome: 'open' } | { outcome: 'rejected'; status: number }> {
    return new Promise((resolve, reject) => {
        const conn = new ws(url);

        conn.on('unexpected-response', (req, res) => {
            conn.terminate();
            resolve({ outcome: 'rejected', status: res.statusCode || 0 });
        });

        conn.on('open', () => {
            conn.close();
            resolve({ outcome: 'open' });
        });

        conn.on('error', (err) => {
            reject(err);
        });
    });
}

test('Streaming: upgrade with an invalid token is rejected with HTTP 401', async () => {
    const url = new URL(flight.base.replace(/^http/, 'ws'));
    url.searchParams.append('format', 'geojson');
    url.searchParams.append('connection', 'admin@example.com');
    url.searchParams.append('token', 'not-a-valid-jwt');

    const res = await attempt(url);

    assert.deepEqual(res, { outcome: 'rejected', status: 401 });
});

test('Streaming: upgrade with no token is rejected with HTTP 401', async () => {
    const url = new URL(flight.base.replace(/^http/, 'ws'));
    url.searchParams.append('format', 'geojson');
    url.searchParams.append('connection', 'admin@example.com');

    const res = await attempt(url);

    assert.deepEqual(res, { outcome: 'rejected', status: 401 });
});

test('Streaming: upgrade with a valid token completes the handshake', async () => {
    const url = new URL(flight.base.replace(/^http/, 'ws'));
    url.searchParams.append('format', 'geojson');
    url.searchParams.append('connection', 'admin@example.com');
    url.searchParams.append('token', flight.token.admin);

    const res = await attempt(url);

    assert.deepEqual(res, { outcome: 'open' });
});

flight.landing();

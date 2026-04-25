import test from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import Flight from './flight.js';
import { Basemap as BasemapParser } from '@tak-ps/node-cot';

const flight = new Flight();

flight.init({ takserver: true });
flight.takeoff();
flight.user();

let upstream: http.Server;
let upstreamOrigin = '';

test('start upstream basemap import server', async () => {
    upstream = http.createServer((req, res) => {
        if (req.method === 'GET' && req.url === '/plain-tilejson.json') {
            res.writeHead(200, { 'content-type': 'application/json' });
            res.end(JSON.stringify({
                name: 'Plain Text Import',
                attribution: 'Unit Test Attribution',
                minzoom: 1,
                maxzoom: 12,
                tiles: [
                    'https://tiles.example.com/plain/{z}/{x}/{y}.png'
                ]
            }));
            return;
        }

        if (req.method === 'GET' && req.url === '/json-tilejson.json') {
            res.writeHead(200, { 'content-type': 'application/json' });
            res.end(JSON.stringify({
                name: 'JSON Import',
                attribution: 'JSON Attribution',
                minzoom: 3,
                maxzoom: 14,
                vector_layers: [
                    {
                        id: 'buildings',
                        fields: {
                            name: 'String'
                        }
                    }
                ],
                tiles: [
                    'https://tiles.example.com/json/{z}/{x}/{y}.jpg'
                ]
            }));
            return;
        }

        res.writeHead(404, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not Found' }));
    });

    await new Promise<void>((resolve) => upstream.listen(0, '127.0.0.1', () => resolve()));

    const address = upstream.address();
    if (!address || typeof address === 'string') throw new Error('Could not determine upstream address');
    upstreamOrigin = `http://127.0.0.1:${address.port}`;
});

test('PUT: api/basemap - import basemap from text/plain URL', async () => {
    const res = await flight.fetch('/api/basemap', {
        method: 'PUT',
        auth: {
            bearer: flight.token.admin
        },
        headers: {
            'Content-Type': 'text/plain'
        },
        body: `${upstreamOrigin}/plain-tilejson.json`
    }, true);

    assert.deepEqual(res.body, {
        type: 'raster',
        name: 'Plain Text Import',
        attribution: 'Unit Test Attribution',
        minzoom: 1,
        maxzoom: 12,
        url: 'https://tiles.example.com/plain/{$z}/{$x}/{$y}.png',
        format: 'png'
    });
});

test('PUT: api/basemap - import basemap from application/json body', async () => {
    const res = await flight.fetch('/api/basemap', {
        method: 'PUT',
        auth: {
            bearer: flight.token.admin
        },
        body: {
            type: 'raster',
            url: `${upstreamOrigin}/json-tilejson.json`
        }
    }, true);

    assert.deepEqual(res.body, {
        type: 'raster',
        name: 'JSON Import',
        attribution: 'JSON Attribution',
        minzoom: 3,
        maxzoom: 14,
        vector_layers: [
            {
                id: 'buildings',
                fields: {
                    name: 'String'
                }
            }
        ],
        url: 'https://tiles.example.com/json/{$z}/{$x}/{$y}.jpg',
        format: 'jpeg'
    });
});

test('PUT: api/basemap - import basemap from multipart TAK XML', async () => {
    const xml = (new BasemapParser({
        customMapSource: {
            name: { _text: 'Multipart Import' },
            minZoom: { _text: 3 },
            maxZoom: { _text: 17 },
            tileType: { _text: 'jpg' },
            tileUpdate: { _text: 'None' },
            url: { _text: 'https://tiles.example.com/multipart/{z}/{x}/{y}.jpg' },
            backgroundColor: { _text: '#000000' },
            serverParts: { _text: 'a,b,c' }
        }
    })).to_xml();

    const body = new FormData();
    body.append('file', new Blob([xml], {
        type: 'text/xml'
    }), 'basemap.cot');

    const res = await flight.fetch('/api/basemap', {
        method: 'PUT',
        auth: {
            bearer: flight.token.admin
        },
        body
    }, true);

    assert.equal(res.body.type, 'raster');
    assert.equal(res.body.name, 'Multipart Import');
    assert.equal(String(res.body.minzoom), '3');
    assert.equal(String(res.body.maxzoom), '17');
    assert.equal(res.body.url, 'https://tiles.example.com/multipart/{z}/{x}/{y}.jpg');
    assert.equal(res.body.format, 'jpeg');
    assert.equal(res.body.serverParts, 'a,b,c');
});

test('stop upstream basemap import server', async () => {
    await new Promise<void>((resolve, reject) => {
        upstream.close((err) => {
            if (err) reject(err);
            else resolve();
        });
    });
});

flight.landing();
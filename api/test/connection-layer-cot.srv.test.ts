process.env.SigningSecret = 'coe-wildland-fire';

import test from 'node:test';
import assert from 'node:assert';
import jwt from 'jsonwebtoken';
import Flight from './flight.js';
import { CoTParser } from '@tak-ps/node-cot';
import { tokenParser } from '../lib/auth.js';

const flight = new Flight();

flight.init({ takserver: true });
flight.takeoff();
flight.user();

flight.connection();

flight.layer();

async function waitForStreamingConnection(timeoutMs: number): Promise<void> {
    if (flight.tak.streamingSockets.size > 0) return;

    await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error(`Timed out after ${timeoutMs} ms waiting for TAK streaming connection`));
        }, timeoutMs);

        flight.tak.streaming.once('secureConnection', () => {
            clearTimeout(timer);
            resolve();
        });
    });
}

async function waitForStreamingCoT(uid: string, timeoutMs: number) {
    return await new Promise((resolve, reject) => {
        const buffers = new Map<any, string>();
        const listeners = new Map<any, (chunk: Buffer) => void>();

        const timer = setTimeout(() => {
            cleanup();
            reject(new Error(`Timed out after ${timeoutMs} ms waiting for streamed CoT ${uid}`));
        }, timeoutMs);

        const onChunk = (socket: any, chunk: Buffer) => {
            let buffer = (buffers.get(socket) || '') + String(chunk);
            const regex = /<event\b[\s\S]*?<\/event>/g;

            let lastIndex = 0;
            let match;
            while ((match = regex.exec(buffer)) !== null) {
                lastIndex = regex.lastIndex;

                try {
                    const cot = CoTParser.from_xml(match[0]);
                    if (cot.uid() === uid) {
                        cleanup();
                        return resolve(cot);
                    }
                } catch {
                    continue;
                }
            }

            if (lastIndex > 0) buffer = buffer.slice(lastIndex);
            buffers.set(socket, buffer);
        };

        const attachSocket = (socket: any) => {
            const handler = (chunk: Buffer) => onChunk(socket, chunk);
            listeners.set(socket, handler);
            socket.on('data', handler);
        };

        const onSecureConnection = (socket: any) => {
            if (!listeners.has(socket)) attachSocket(socket);
        };

        const cleanup = () => {
            clearTimeout(timer);
            flight.tak.streaming.off('secureConnection', onSecureConnection);

            for (const [socket, handler] of listeners.entries()) {
                socket.off('data', handler);
            }

            listeners.clear();
            buffers.clear();
        };

        for (const socket of flight.tak.streamingSockets) {
            attachSocket(socket);
        }

        flight.tak.streaming.on('secureConnection', onSecureConnection);
    });
}

test('POST: api/layer/1/cot - sends GeoJSON feature to TAK', async () => {
    try {
        const layer = await flight.config!.models.Layer.from(1);

        const incoming = await flight.config!.models.LayerIncoming.generate({
            layer: layer.id
        });

        assert.equal(layer.connection, 1);
        assert.equal(incoming.layer, layer.id);
        assert.equal(incoming.webhooks, false);
        assert.equal(incoming.enabled_styles, false);
        assert.deepEqual(incoming.styles, {});

        flight.tak.reset();

        const uid = 'test-connection-layer-cot';
        const time = new Date().toISOString();
        const stale = new Date(Date.now() + 5 * 60 * 1000).toISOString();
        const token = `etl.${jwt.sign({ access: 'layer', id: layer.id, internal: true }, flight.config!.SigningSecret)}`;

        const parsed = await tokenParser(flight.config!, token, flight.config!.SigningSecret);
        assert.equal(parsed.access, 'layer');

        const post = await fetch(new URL(`/api/layer/${layer.id}/cot?archive=false`, flight.base), {
            method: 'POST',
            redirect: 'manual',
            headers: new Headers({
                authorization: `Bearer ${token}`,
                'content-type': 'application/json'
            }),
            body: JSON.stringify({
                type: 'FeatureCollection',
                features: [{
                    id: uid,
                    type: 'Feature',
                    path: '/Test Features/',
                    properties: {
                        type: 'a-f-g',
                        how: 'm-g',
                        time,
                        start: time,
                        stale,
                        callsign: 'Test Callsign',
                        archived: true,
                        center: [123.3223, 123.0002]
                    },
                    geometry: {
                        type: 'Point',
                        coordinates: [123.3223, 123.0002, 123]
                    }
                }]
            })
        });

        const res = await post.json();

        assert.equal(post.status, 200, JSON.stringify(res));
        assert.deepEqual(res, {
            status: 200,
            message: 'Submitted',
            errors: []
        });

        const cot = await waitForStreamingCoT(uid, 5000);
        const feature = await CoTParser.to_geojson(cot);

        assert.equal(cot.uid(), uid);
        assert.equal(feature.properties.callsign, 'Test Callsign');
        assert.equal(feature.properties.type, 'a-f-g');
        assert.deepEqual(feature.geometry, {
            type: 'Point',
            coordinates: [123.3223, 123.0002, 123]
        });
    } catch (err) {
        assert.ifError(err);
    }
});

flight.landing();

import test from 'node:test';
import assert from 'node:assert';
import { Type } from '@sinclair/typebox';
import { fetch } from '@tak-ps/etl';
import Flight from './flight.js';

const flight = new Flight();

flight.init();
flight.takeoff();
flight.user();

test('GET: Ensure DFPC AGOL Portal is up and running', async () => {
    try {
        const res = await fetch('https://co-dfpc.maps.arcgis.com/sharing/rest?f=json');

        await res.typed(Type.Object({
            currentVersion: Type.String()
        }));
    } catch (err) {
        assert.ifError(err)
    }
});

test('PATCH: api/esri/portal/content', async () => {
    try {
        const res = await flight.fetch('/api/esri/portal/content?portal=https://co-dfpc.maps.arcgis.com/sharing/rest', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, false);

        assert.ok(res.body.total)
    } catch (err) {
        assert.ifError(err)
    }
});

flight.landing();

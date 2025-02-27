import test from 'tape';
import { Type } from '@sinclair/typebox';
import { fetch } from '@tak-ps/etl';
import Flight from './flight.js';

const flight = new Flight();

flight.init();
flight.takeoff();
flight.user();

test('GET: Ensure DFPC AGOL Portal is up and running', async (t) => {
    try {
        const res = await fetch('https://co-dfpc.maps.arcgis.com/sharing/rest?f=json', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, false);

        await res.typed(Type.Object({
            currentVersion: Type.String()
        }));
    } catch (err) {
        t.error(err)
    }

    t.end();
});

test('PATCH: api/esri/portal/content', async (t) => {
    try {
        const res = await flight.fetch('/api/esri/portal/content?portal=https://co-dfpc.maps.arcgis.com/sharing/rest', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, false);

        t.ok(res.body.total)
    } catch (err) {
        t.error(err)
    }

    t.end();
});

flight.landing();

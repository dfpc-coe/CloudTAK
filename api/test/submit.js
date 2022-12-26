import fs from 'fs';
import test from 'tape';
import Flight from './flight.js';

const flight = new Flight();

flight.init(test, false);
//flight.takeoff(test);

test('POST: api/layer/1/cot - no Content-Type', async (t) => {
    try {
        const res = await flight.fetch('/api/layer/1/cot', {
            method: 'POST',
        }, false);

        t.deepEquals(res.body, {
            status: 400, message: 'Content-Type not set', messages: []
        });
    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});

test('POST: api/layer/1/cot - Polygon Feature', async (t) => {
    try {
        const res = await flight.fetch('/api/layer/1/cot', {
            method: 'POST',
            body: {
                type: 'FeatureCollection',
                features: [{
                    id: 'polygon',
                    type: 'Feature',
                    properties: {},
                    geometry: {
                        type: 'Polygon',
                        coordinates: [[
                            [ -105.29960937156164, 39.96301284284269 ],
                            [ -105.29960937156164, 39.582694262785765 ],
                            [ -104.76913416804953, 39.582694262785765 ],
                            [ -104.76913416804953, 39.96301284284269 ],
                            [ -105.29960937156164, 39.96301284284269 ]
                        ]],
                    }
                }]
            }
        }, false);

        t.deepEquals(res.body, {
            status: 200,
            message: 'Submitted'
        });
    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});

test('POST: api/layer/1/cot - LineString Feature', async (t) => {
    try {
        const res = await flight.fetch('/api/layer/1/cot', {
            method: 'POST',
            body: {
                type: 'FeatureCollection',
                features: [{
                    id: 'linestring',
                    type: "Feature",
                    properties: {},
                    geometry: {
                        type: 'LineString',
                        coordinates: [
                            [ -105.58686274263341, 39.852035411298175 ],
                            [ -105.45267138680421, 40.02244841390802 ],
                            [ -105.10461255762253, 40.08183225394524 ]
                        ],
                    }
                }]
            }
        }, false);

        t.deepEquals(res.body, {
            status: 200,
            message: 'Submitted'
        });
    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});

//flight.landing(test);

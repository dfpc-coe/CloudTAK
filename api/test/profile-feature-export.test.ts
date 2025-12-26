import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';

const flight = new Flight();

flight.init();
flight.takeoff();
flight.user();

const time = new Date('2025-03-04T22:54:15.447Z').toISOString()

test('GET: api/profile/feature?format=geojson&download=true', async () => {
    try {
        const res = await flight.fetch('/api/profile/feature?format=geojson&download=true', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, false);

        assert.ok(res.headers.get('content-disposition').includes('attachment; filename="admin@example.com-export-'));
        assert.equal(res.headers.get('content-type'), "application/geo+json");
        assert.equal(res.headers.get('content-length'), "55");

        assert.deepEqual(res.body, {
            type: 'FeatureCollection',
            features: []
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/profile/feature?format=kml&download=true', async () => {
    try {
        const res = await flight.fetch('/api/profile/feature?format=kml&download=true', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, {
            json: false
        });

        assert.ok(res.headers.get('content-disposition').includes('attachment; filename="admin@example.com-export-'));
        assert.equal(res.headers.get('content-type'), "application/vnd.google-earth.kml+xml");
        assert.equal(res.headers.get('content-length'), "220");

        assert.equal(
            res.body.replace(/\d{4}-\d{2}-\d{2}T.*?Z/, 'DATE'),
            '<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>admin@example.com-export-DATE</name><description>Exported from CloudTAK</description></Document></kml>'
        );
    } catch (err) {
        assert.ifError(err);
    }
});

test('PUT: api/profile/feature', async () => {
    try {
        const res = await flight.fetch('/api/profile/feature', {
            method: 'PUT',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                id: '123',
                type: 'Feature',
                path: '/Test Features/',
                properties: {
                    type: 'a-f-g',
                    how: 'm-g',
                    time: time,
                    start: time,
                    stale: time,
                    callsign: 'Test Callsign',
                    archived: true,
                    center: [123.3223, 123.0002],
                    testprop: 1,
                    testnested: {
                        deep: 1
                    }
                },
                geometry: {
                    type: 'Point',
                    coordinates: [123.3223, 123.0002, 123]
                }
            }
        }, true);

        assert.deepEqual(res.body, {
            id: '123',
            type: 'Feature',
            path: '/Test Features/',
            properties: {
                type: 'a-f-g',
                how: 'm-g',
                archived: true,
                callsign: 'Test Callsign',
                time: time,
                start: time,
                stale: time,
                center: [123.3223, 123.0002],
            },
            geometry: {
                type: 'Point',
                coordinates: [123.3223, 123.0002, 123]
            }
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('PUT: api/profile/feature - To Be Deleted to ensure deleted features aren\'t included by default', async () => {
    try {
        const res = await flight.fetch('/api/profile/feature', {
            method: 'PUT',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                id: '321',
                type: 'Feature',
                path: '/Test Features/',
                properties: {
                    type: 'a-f-g',
                    how: 'm-g',
                    time: time,
                    start: time,
                    stale: time,
                    callsign: 'Test Callsign',
                    archived: true,
                    center: [123.3223, 123.0002],
                    testprop: 1,
                    testnested: {
                        deep: 1
                    }
                },
                geometry: {
                    type: 'Point',
                    coordinates: [123.3223, 123.0002, 123]
                }
            }
        }, true);

        assert.deepEqual(res.body, {
            id: '321',
            type: 'Feature',
            path: '/Test Features/',
            properties: {
                type: 'a-f-g',
                how: 'm-g',
                archived: true,
                callsign: 'Test Callsign',
                time: time,
                start: time,
                stale: time,
                center: [123.3223, 123.0002],
            },
            geometry: {
                type: 'Point',
                coordinates: [123.3223, 123.0002, 123]
            }
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('DELETE: api/profile/feature?id=321', async () => {
    try {
        await flight.fetch('/api/profile/feature/321', {
            method: 'DELETE',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/profile/feature?format=geojson&download=true', async () => {
    try {
        const res = await flight.fetch('/api/profile/feature?format=geojson&download=true', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, {
            json: false
        });

        assert.ok(res.headers.get('content-disposition').includes('attachment; filename="admin@example.com-export-'));
        assert.equal(res.headers.get('content-type'), "application/geo+json");
        assert.equal(res.headers.get('content-length'), "995");

        res.body = JSON.parse(res.body.replace(/\d{4}-\d{2}-\d{2}T.*?Z/g, 'DATE'))
        assert.deepEqual(res.body, { type: 'FeatureCollection', features: [ { id: '123', path: '/Test Features/', type: 'Feature', properties: { type: 'a-f-g', how: 'm-g', time: 'DATE', start: 'DATE', stale: 'DATE', callsign: 'Test Callsign', archived: true, center: [ 123.3223, 123.0002 ] }, geometry: { type: 'Point', coordinates: [ 123.3223, 123.0002, 123 ], bbox: [ 123.3223, 123.0002, 123.3223, 123.0002 ] } } ] });
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/profile/feature?format=kml&download=true', async () => {
    try {
        const res = await flight.fetch('/api/profile/feature?format=kml&download=true', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, {
            json: false
        });

        assert.ok(res.headers.get('content-disposition').includes('attachment; filename="admin@example.com-export-'));
        assert.equal(res.headers.get('content-type'), "application/vnd.google-earth.kml+xml");
        assert.equal(res.headers.get('content-length'), "806");

        assert.equal(
            res.body.replace(/\d{4}-\d{2}-\d{2}T.*?Z/, 'DATE'),
            '<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>admin@example.com-export-DATE</name><description>Exported from CloudTAK</description><Placemark><name>Test Callsign</name><ExtendedData><Data name="type"><value>a-f-g</value></Data><Data name="how"><value>m-g</value></Data><Data name="time"><value>2025-03-04T22:54:15.447Z</value></Data><Data name="start"><value>2025-03-04T22:54:15.447Z</value></Data><Data name="stale"><value>2025-03-04T22:54:15.447Z</value></Data><Data name="callsign"><value>Test Callsign</value></Data><Data name="archived"><value>true</value></Data><Data name="center"><value>123.3223,123.0002</value></Data></ExtendedData><Point><coordinates>123.3223,123.0002,123</coordinates></Point></Placemark></Document></kml>'
        );
    } catch (err) {
        assert.ifError(err);
    }
});

flight.landing();

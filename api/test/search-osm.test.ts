import test from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import { AddressInfo } from 'node:net';
import { GenerateUpsert } from '@openaddresses/batch-generic';
import { Type } from '@sinclair/typebox';
import OSMSearch, { OSM_PUBLIC_API, searchType } from '../stateless/lib/search/osm.js';
import { SearchManager } from '../stateless/lib/interface-search.js';
import Config from '../common/config.js';
import { testDatabase } from './db.js';

const capitolLabel = 'Colorado State Capitol, 200 East Colfax Avenue, Denver, CO 80203, United States';

const capitol = {
    type: 'Feature',
    properties: {
        osm_type: 'W',
        osm_id: 42,
        osm_key: 'building',
        osm_value: 'government',
        type: 'house',
        housenumber: '200',
        name: 'Colorado State Capitol',
        street: 'East Colfax Avenue',
        locality: 'Capitol Hill',
        city: 'Denver',
        state: 'CO',
        country: 'United States',
        postcode: '80203',
        countrycode: 'US',
        extent: [-104.9909, 39.7396, -104.9897, 39.7389],
    },
    geometry: { type: 'Point', coordinates: [-104.9903, 39.7392] },
};

const denver = {
    type: 'Feature',
    properties: {
        osm_type: 'R',
        osm_id: 7,
        osm_key: 'place',
        osm_value: 'city',
        type: 'city',
        name: 'Denver',
        county: 'Denver',
        state: 'CO',
        country: 'United States',
        countrycode: 'US',
        extent: [-105.1099, 39.9142, -104.5997, 39.6143],
    },
    geometry: { type: 'Point', coordinates: [-105, 39.7] },
};

const requests: Array<{ url: URL; userAgent?: string }> = [];

const server = http.createServer((req, res) => {
    const url = new URL(req.url || '/', 'http://localhost');
    requests.push({ url, userAgent: req.headers['user-agent'] });

    res.setHeader('Content-Type', 'application/json');

    if (url.pathname === '/reverse') {
        res.end(JSON.stringify({
            type: 'FeatureCollection',
            features: url.searchParams.get('lat') === '0' ? [] : [capitol],
        }));
    } else if (url.pathname === '/api') {
        res.end(JSON.stringify({
            type: 'FeatureCollection',
            features: url.searchParams.get('q') === 'nowhere' ? [] : [capitol, denver],
        }));
    } else {
        res.statusCode = 404;
        res.end(JSON.stringify({ message: 'Not Found' }));
    }
});

let config: Config;
let osm: OSMSearch;

test('OSM - setup', async () => {
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));

    config = await Config.env({
        postgres: await testDatabase({ reset: false }),
        silent: true,
        noevents: true,
        noetlevents: true,
        nocache: true,
    });

    osm = new OSMSearch(config, `http://127.0.0.1:${(server.address() as AddressInfo).port}/`);
});

test('OSM - constructor', async () => {
    assert.equal(osm._id, 'osm');
    assert.equal(osm._name, 'OpenStreetMap');
    assert.ok(!osm.api.endsWith('/'), 'Trailing slash stripped');
    const pub = new OSMSearch(config);
    assert.equal(pub.api, OSM_PUBLIC_API);
});

test('OSM - config', async () => {
    assert.deepEqual(await osm.config(), {
        id: 'osm',
        name: 'OpenStreetMap',
        reverse: { supported: true },
        forward: { supported: true },
    });
});

test('OSM - init disabled by default', async () => {
    assert.equal(await OSMSearch.init(config), null);

    const manager = await SearchManager.init(config);
    assert.equal(manager.has('osm'), false);
});

test('OSM - init enabled', async () => {
    await config.models.Setting.generate({ key: 'osm::enabled', value: 'true' }, { upsert: GenerateUpsert.UPDATE });
    await config.models.Setting.generate({ key: 'osm::url', value: 'https://photon.example.com/' }, { upsert: GenerateUpsert.UPDATE });

    const enabled = await OSMSearch.init(config);
    assert.ok(enabled);
    assert.equal(enabled.api, 'https://photon.example.com');

    const manager = await SearchManager.init(config);
    assert.equal(manager.defaultProvider, 'osm');
    assert.deepEqual((await manager.config()).forward.providers, [{ id: 'osm', name: 'OpenStreetMap' }]);
    assert.deepEqual((await manager.config()).reverse.providers, [{ id: 'osm', name: 'OpenStreetMap' }]);

    await config.models.Setting.generate({ key: 'osm::enabled', value: 'false' }, { upsert: GenerateUpsert.UPDATE });
});

test('OSM - reverse', async () => {
    requests.length = 0;

    const reverse = await osm.reverse(-104.9903, 39.7392);

    assert.deepEqual(reverse, {
        type: 'poi',
        LongLabel: capitolLabel,
        ShortLabel: 'Colorado State Capitol',
        Addr_type: 'house',
    });

    assert.equal(requests.length, 1);
    assert.equal(requests[0].url.pathname, '/reverse');
    assert.equal(requests[0].url.searchParams.get('lon'), '-104.9903');
    assert.equal(requests[0].url.searchParams.get('lat'), '39.7392');
    assert.equal(requests[0].url.searchParams.get('limit'), '1');
    assert.equal(requests[0].userAgent, `CloudTAK (${config.API_URL})`);
});

test('OSM - reverse error', async () => {
    await assert.rejects(osm.reverse(0, 0), /Unable to geocode/);
});

test('OSM - suggest', async () => {
    requests.length = 0;

    const items = await osm.suggest('Capitol', 5, [-105, 39.7]);

    assert.deepEqual(items, [{
        type: 'poi',
        text: capitolLabel,
        magicKey: 'W42@-104.9903,39.7392@-104.9909,39.7396,-104.9897,39.7389@poi',
        isCollection: false,
    }, {
        type: 'locality',
        text: 'Denver, CO, United States',
        magicKey: 'R7@-105,39.7@-105.1099,39.9142,-104.5997,39.6143@locality',
        isCollection: false,
    }]);

    assert.equal(requests[0].url.pathname, '/api');
    assert.equal(requests[0].url.searchParams.get('q'), 'Capitol');
    assert.equal(requests[0].url.searchParams.get('limit'), '5');
    assert.equal(requests[0].url.searchParams.get('lon'), '-105');
    assert.equal(requests[0].url.searchParams.get('lat'), '39.7');
});

test('OSM - suggest empty', async () => {
    requests.length = 0;

    assert.deepEqual(await osm.suggest('   '), []);
    assert.deepEqual(await osm.suggest('nowhere'), []);
    assert.equal(requests.length, 1, 'Blank query does not hit the API');
});

test('OSM - forward by magicKey', async () => {
    requests.length = 0;

    const [suggestion] = await osm.suggest('Capitol');
    requests.length = 0;

    const items = await osm.forward(suggestion.text, suggestion.magicKey);

    assert.equal(requests.length, 0, 'Suggestion is resolved without hitting the API');

    for (const key of ['xmin', 'ymin', 'xmax', 'ymax'] as const) {
        items[0].extent[key] = Number(items[0].extent[key].toFixed(4));
    }

    assert.deepEqual(items, [{
        type: 'poi',
        address: capitolLabel,
        location: { x: -104.9903, y: 39.7392 },
        score: 100,
        attributes: {
            LongLabel: capitolLabel,
            ShortLabel: 'Colorado State Capitol',
        },
        extent: {
            xmin: -104.9953,
            ymin: 39.7342,
            xmax: -104.9853,
            ymax: 39.7442,
            spatialReference: { wkid: 4326 },
        },
    }]);
});

test('OSM - forward by magicKey keeps large extents', async () => {
    const items = await osm.forward('Denver, CO, United States', 'R7@-105,39.7@-105.1099,39.9142,-104.5997,39.6143');

    assert.equal(items[0].type, undefined, 'Type is optional in the key');

    assert.deepEqual(items[0].extent, {
        xmin: -105.1099,
        ymin: 39.6143,
        xmax: -104.5997,
        ymax: 39.9142,
        spatialReference: { wkid: 4326 },
    });
});

test('OSM - forward by magicKey out of range', async () => {
    requests.length = 0;

    await osm.forward('Denver', 'N1@-200,95');

    assert.equal(requests.length, 1, 'Invalid location falls back to a query');
    assert.equal(requests[0].url.pathname, '/api');
});

test('OSM - forward by query', async () => {
    requests.length = 0;

    const items = await osm.forward('Denver', 'test', 2);

    assert.equal(requests[0].url.pathname, '/api');
    assert.equal(requests[0].url.searchParams.get('q'), 'Denver');
    assert.equal(requests[0].url.searchParams.get('limit'), '2');

    assert.equal(items.length, 2);
    assert.equal(items[1].address, 'Denver, CO, United States');
    assert.equal(items[1].attributes.ShortLabel, 'Denver');
    assert.equal(items[0].type, 'poi');
    assert.equal(items[1].type, 'locality');
    assert.equal(items[1].score, 100);
    assert.deepEqual(items[1].location, { x: -105, y: 39.7 });
    assert.equal(items[1].extent.ymin, 39.6143);
    assert.equal(items[1].extent.ymax, 39.9142);

    assert.deepEqual(await osm.forward('', 'test'), []);
});

test('OSM - forward by magicKey without extent', async () => {
    const items = await osm.forward('Pikes Peak', 'N9@-105.0423,38.8405@peak');

    assert.equal(items[0].type, 'peak');
    assert.deepEqual(items[0].location, { x: -105.0423, y: 38.8405 });

    const unknown = await osm.forward('Pikes Peak', 'N9@-105.0423,38.8405@unknown');
    assert.equal(unknown[0].type, undefined, 'Unknown types are dropped');
});

test('OSM - searchType', async () => {
    const cases: Array<[Parameters<typeof searchType>[0], string | undefined]> = [
        [{ type: 'street', osm_key: 'highway', osm_value: 'primary', name: 'East Colfax Avenue' }, 'street'],
        [{ type: 'street', osm_key: 'highway', osm_value: 'unclassified', name: 'Bear Lake Trailhead Road' }, 'street'],
        [{ type: 'house', osm_key: 'place', osm_value: 'house', housenumber: '200' }, 'address'],
        [{ type: 'house', osm_key: 'building', osm_value: 'yes', housenumber: '200' }, 'address'],
        [{ type: 'house', osm_key: 'amenity', osm_value: 'theatre', name: 'Red Rocks Amphitheatre' }, 'poi'],
        [{ type: 'other', osm_key: 'natural', osm_value: 'water', name: 'Bear Lake' }, 'poi'],
        [{ type: 'locality', osm_key: 'landuse', osm_value: 'allotments', name: 'Community Garden' }, 'poi'],
        [{ type: 'house', osm_key: 'highway', osm_value: 'trailhead', name: 'Bear Lake' }, 'trailhead'],
        [{ type: 'house', osm_key: 'amenity', osm_value: 'parking', name: 'Mount Falcon Park West Trailhead' }, 'trailhead'],
        [{ type: 'house', osm_key: 'amenity', osm_value: 'parking', name: 'Lot C' }, 'parking'],
        [{ type: 'house', osm_key: 'amenity', osm_value: 'parking' }, 'parking'],
        [{ type: 'house', osm_key: 'building', osm_value: 'hospital', name: 'Denver Health' }, 'hospital'],
        [{ type: 'house', osm_key: 'amenity', osm_value: 'hospital', name: 'Denver Health' }, 'hospital'],
        [{ type: 'house', osm_key: 'amenity', osm_value: 'police', name: 'District 6' }, 'police'],
        [{ type: 'other', osm_key: 'leisure', osm_value: 'park', name: 'Washington Park' }, 'park'],
        [{ type: 'other', osm_key: 'leisure', osm_value: 'nature_reserve', name: 'Rocky Mountain National Park' }, 'park'],
        [{ type: 'other', osm_key: 'natural', osm_value: 'peak', name: 'Pikes Peak' }, 'peak'],
        [{ type: 'locality', osm_key: 'place', osm_value: 'neighbourhood', name: 'Capitol Hill' }, 'locality'],
        [{ type: 'city', osm_key: 'place', osm_value: 'city', name: 'Denver' }, 'locality'],
        [{ type: 'county', osm_key: 'boundary', osm_value: 'administrative', name: 'Jefferson County' }, 'region'],
        [{ type: 'state', osm_key: 'place', osm_value: 'state', name: 'Colorado' }, 'region'],
        [{ type: 'other', osm_key: 'place', osm_value: 'postcode', name: '80203' }, 'postal'],
        [{ type: 'other' }, undefined],
    ];

    for (const [props, expected] of cases) {
        assert.equal(searchType(props), expected, JSON.stringify(props));
    }
});

test('OSM - upstream failure', async () => {
    await assert.rejects(osm.fetch('/missing', {}, Type.Any()), /Photon API failed: 404/);
});

test('OSM - teardown', async () => {
    await new Promise<void>(resolve => server.close(() => resolve()));
    await config.pg.end();
});

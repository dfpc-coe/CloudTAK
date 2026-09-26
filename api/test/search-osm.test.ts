import test from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import { AddressInfo } from 'node:net';
import { GenerateUpsert } from '@openaddresses/batch-generic';
import { Type } from '@sinclair/typebox';
import OSMSearch, { OSM_PUBLIC_API } from '../stateless/lib/search/osm.js';
import { SearchManager } from '../stateless/lib/interface-search.js';
import Config from '../common/config.js';
import { testDatabase } from './db.js';

const capitol = {
    place_id: 1,
    osm_type: 'way',
    osm_id: 42,
    lat: '39.7392',
    lon: '-104.9903',
    name: 'Colorado State Capitol',
    display_name: 'Colorado State Capitol, 200, East Colfax Avenue, Denver, Colorado, 80203, United States',
    addresstype: 'building',
    type: 'government',
    importance: 0.42,
    boundingbox: ['39.7389', '39.7396', '-104.9909', '-104.9897'],
};

const requests: Array<{ url: URL; userAgent?: string }> = [];

const server = http.createServer((req, res) => {
    const url = new URL(req.url || '/', 'http://localhost');
    requests.push({ url, userAgent: req.headers['user-agent'] });

    res.setHeader('Content-Type', 'application/json');

    if (url.pathname === '/reverse') {
        if (url.searchParams.get('lat') === '0') {
            res.end(JSON.stringify({ error: 'Unable to geocode' }));
        } else {
            res.end(JSON.stringify(capitol));
        }
    } else if (url.pathname === '/search') {
        if (url.searchParams.get('q') === 'nowhere') {
            res.end(JSON.stringify([]));
        } else {
            res.end(JSON.stringify([capitol, {
                place_id: 2,
                lat: '39.7',
                lon: '-105',
                display_name: 'Denver, Colorado, United States',
            }]));
        }
    } else if (url.pathname === '/lookup') {
        res.end(JSON.stringify([capitol]));
    } else {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: { code: 404, message: 'Not Found' } }));
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
    assert.equal(osm.throttled, false, 'Self-hosted instance is not throttled');

    const pub = new OSMSearch(config);
    assert.equal(pub.api, OSM_PUBLIC_API);
    assert.equal(pub.throttled, true, 'Public instance is throttled');
});

test('OSM - config', async () => {
    assert.deepEqual(await osm.config(), {
        id: 'osm',
        name: 'OpenStreetMap',
        reverse: { supported: true },
        forward: { supported: true },
        route: { supported: false, modes: [] },
    });
});

test('OSM - init disabled by default', async () => {
    assert.equal(await OSMSearch.init(config), null);

    const manager = await SearchManager.init(config);
    assert.equal(manager.has('osm'), false);
});

test('OSM - init enabled', async () => {
    await config.models.Setting.generate({ key: 'osm::enabled', value: 'true' }, { upsert: GenerateUpsert.UPDATE });
    await config.models.Setting.generate({ key: 'osm::url', value: 'https://nominatim.example.com/' }, { upsert: GenerateUpsert.UPDATE });

    const enabled = await OSMSearch.init(config);
    assert.ok(enabled);
    assert.equal(enabled.api, 'https://nominatim.example.com');

    const manager = await SearchManager.init(config);
    assert.equal(manager.defaultProvider, 'osm');
    assert.deepEqual((await manager.config()).forward.providers, [{ id: 'osm', name: 'OpenStreetMap' }]);
    assert.deepEqual((await manager.config()).route.providers, []);

    await config.models.Setting.generate({ key: 'osm::enabled', value: 'false' }, { upsert: GenerateUpsert.UPDATE });
});

test('OSM - reverse', async () => {
    requests.length = 0;

    const reverse = await osm.reverse(-104.9903, 39.7392);

    assert.deepEqual(reverse, {
        LongLabel: capitol.display_name,
        ShortLabel: 'Colorado State Capitol',
        Addr_type: 'building',
    });

    assert.equal(requests.length, 1);
    assert.equal(requests[0].url.pathname, '/reverse');
    assert.equal(requests[0].url.searchParams.get('format'), 'jsonv2');
    assert.equal(requests[0].url.searchParams.get('lon'), '-104.9903');
    assert.equal(requests[0].url.searchParams.get('lat'), '39.7392');
    assert.equal(requests[0].userAgent, `CloudTAK (${config.API_URL})`);
});

test('OSM - reverse error', async () => {
    await assert.rejects(osm.reverse(0, 0), /Unable to geocode/);
});

test('OSM - suggest', async () => {
    requests.length = 0;

    const items = await osm.suggest('Capitol', 5, [-105, 39.7]);

    assert.deepEqual(items, [{
        text: capitol.display_name,
        magicKey: 'W42',
        isCollection: false,
    }, {
        text: 'Denver, Colorado, United States',
        magicKey: '2',
        isCollection: false,
    }]);

    assert.equal(requests[0].url.pathname, '/search');
    assert.equal(requests[0].url.searchParams.get('q'), 'Capitol');
    assert.equal(requests[0].url.searchParams.get('limit'), '5');
    assert.equal(requests[0].url.searchParams.get('viewbox'), '-105.5,39.2,-104.5,40.2');
});

test('OSM - suggest empty', async () => {
    requests.length = 0;

    assert.deepEqual(await osm.suggest('   '), []);
    assert.deepEqual(await osm.suggest('nowhere'), []);
    assert.equal(requests.length, 1, 'Blank query does not hit the API');
});

test('OSM - forward by osm id', async () => {
    requests.length = 0;

    const items = await osm.forward('Capitol', 'W42');

    assert.equal(requests[0].url.pathname, '/lookup');
    assert.equal(requests[0].url.searchParams.get('osm_ids'), 'W42');

    for (const key of ['xmin', 'ymin', 'xmax', 'ymax'] as const) {
        items[0].extent[key] = Number(items[0].extent[key].toFixed(4));
    }

    assert.deepEqual(items, [{
        address: capitol.display_name,
        location: { x: -104.9903, y: 39.7392 },
        score: 42,
        attributes: {
            LongLabel: capitol.display_name,
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

test('OSM - forward by query', async () => {
    requests.length = 0;

    const items = await osm.forward('Denver', 'test', 2);

    assert.equal(requests[0].url.pathname, '/search');
    assert.equal(requests[0].url.searchParams.get('q'), 'Denver');
    assert.equal(requests[0].url.searchParams.get('limit'), '2');

    assert.equal(items.length, 2);
    assert.equal(items[1].address, 'Denver, Colorado, United States');
    assert.equal(items[1].attributes.ShortLabel, 'Denver');
    assert.equal(items[1].score, 100);
    assert.deepEqual(items[1].location, { x: -105, y: 39.7 });
    assert.ok(items[1].extent.xmax > items[1].extent.xmin, 'Point results get a padded extent');

    assert.deepEqual(await osm.forward('', 'test'), []);
});

test('OSM - upstream failure', async () => {
    await assert.rejects(osm.fetch('/missing', {}, Type.Any()), /Nominatim API failed: 404/);
});

test('OSM - teardown', async () => {
    await new Promise<void>(resolve => server.close(() => resolve()));
    await config.pg.end();
});

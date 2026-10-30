import test from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import { readFileSync } from 'node:fs';
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
                    'https://tiles.example.com/plain/{z}/{x}/{y}.png',
                ],
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
                            name: 'String',
                        },
                    },
                ],
                tiles: [
                    'https://tiles.example.com/json/{z}/{x}/{y}.jpg',
                ],
            }));
            return;
        }

        if (req.method === 'GET' && req.url === '/wmts/nsw/WMTSCapabilities.xml') {
            res.writeHead(200, { 'content-type': 'text/xml;charset=utf-8' });
            res.end(readFileSync(new URL('./fixtures/wmts-nsw-topo.xml', import.meta.url), 'utf8'));
            return;
        }

        if (req.method === 'GET' && req.url?.startsWith('/wmts/kvp?')) {
            res.writeHead(200, { 'content-type': 'application/xml' });
            res.end(`<?xml version="1.0" encoding="UTF-8"?>
<Capabilities xmlns="http://www.opengis.net/wmts/1.0" xmlns:ows="http://www.opengis.net/ows/1.1" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.0.0">
  <ows:ServiceProvider><ows:ProviderName>Unit Test Provider</ows:ProviderName></ows:ServiceProvider>
  <ows:OperationsMetadata>
    <ows:Operation name="GetTile">
      <ows:DCP><ows:HTTP>
        <ows:Get xlink:href="https://wmts.example.com/geoserver/gwc/service/wmts?">
          <ows:Constraint name="GetEncoding"><ows:AllowedValues><ows:Value>KVP</ows:Value></ows:AllowedValues></ows:Constraint>
        </ows:Get>
      </ows:HTTP></ows:DCP>
    </ows:Operation>
  </ows:OperationsMetadata>
  <Contents>
    <Layer>
      <ows:Title>Parcels</ows:Title>
      <ows:Identifier>test:parcels</ows:Identifier>
      <Style isDefault="true"><ows:Identifier>parcels-style</ows:Identifier></Style>
      <Format>image/jpeg</Format>
      <Format>image/png</Format>
      <TileMatrixSetLink><TileMatrixSet>EPSG:4326</TileMatrixSet></TileMatrixSetLink>
      <TileMatrixSetLink>
        <TileMatrixSet>EPSG:900913</TileMatrixSet>
        <TileMatrixSetLimits>
          <TileMatrixLimits><TileMatrix>EPSG:900913:5</TileMatrix></TileMatrixLimits>
          <TileMatrixLimits><TileMatrix>EPSG:900913:6</TileMatrix></TileMatrixLimits>
        </TileMatrixSetLimits>
      </TileMatrixSetLink>
    </Layer>
    <Layer>
      <ows:Title>Roads</ows:Title>
      <ows:Identifier>test:roads</ows:Identifier>
      <Style isDefault="true"><ows:Identifier>roads-style</ows:Identifier></Style>
      <Format>image/png</Format>
      <TileMatrixSetLink><TileMatrixSet>EPSG:900913</TileMatrixSet></TileMatrixSetLink>
    </Layer>
    <TileMatrixSet>
      <ows:Identifier>EPSG:4326</ows:Identifier>
      <ows:SupportedCRS>urn:ogc:def:crs:EPSG::4326</ows:SupportedCRS>
      <TileMatrix><ows:Identifier>EPSG:4326:0</ows:Identifier><ScaleDenominator>2.795411320143589E8</ScaleDenominator><TopLeftCorner>90.0 -180.0</TopLeftCorner><TileWidth>256</TileWidth><TileHeight>256</TileHeight><MatrixWidth>2</MatrixWidth><MatrixHeight>1</MatrixHeight></TileMatrix>
    </TileMatrixSet>
    <TileMatrixSet>
      <ows:Identifier>EPSG:900913</ows:Identifier>
      <ows:SupportedCRS>urn:ogc:def:crs:EPSG::900913</ows:SupportedCRS>
      <TileMatrix><ows:Identifier>EPSG:900913:4</ows:Identifier><ScaleDenominator>3.4942641501794593E7</ScaleDenominator><TopLeftCorner>-2.003750834E7 2.0037508E7</TopLeftCorner><TileWidth>256</TileWidth><TileHeight>256</TileHeight><MatrixWidth>16</MatrixWidth><MatrixHeight>16</MatrixHeight></TileMatrix>
      <TileMatrix><ows:Identifier>EPSG:900913:5</ows:Identifier><ScaleDenominator>1.7471320750897296E7</ScaleDenominator><TopLeftCorner>-2.003750834E7 2.0037508E7</TopLeftCorner><TileWidth>256</TileWidth><TileHeight>256</TileHeight><MatrixWidth>32</MatrixWidth><MatrixHeight>32</MatrixHeight></TileMatrix>
      <TileMatrix><ows:Identifier>EPSG:900913:6</ows:Identifier><ScaleDenominator>8735660.375448648</ScaleDenominator><TopLeftCorner>-2.003750834E7 2.0037508E7</TopLeftCorner><TileWidth>256</TileWidth><TileHeight>256</TileHeight><MatrixWidth>64</MatrixWidth><MatrixHeight>64</MatrixHeight></TileMatrix>
    </TileMatrixSet>
  </Contents>
</Capabilities>`);
            return;
        }

        if (req.method === 'GET' && req.url === '/wms?SERVICE=WMS&REQUEST=GetCapabilities') {
            res.writeHead(200, { 'content-type': 'text/xml' });
            res.end('<?xml version="1.0"?><WMS_Capabilities xmlns="http://www.opengis.net/wms" version="1.3.0"><Service><Name>WMS</Name></Service></WMS_Capabilities>');
            return;
        }

        if (req.method === 'GET' && req.url === '/index.html') {
            res.writeHead(200, { 'content-type': 'text/html' });
            res.end('<!DOCTYPE html><html><body>Not a tile service</body></html>');
            return;
        }

        if (req.method === 'GET' && req.url === '/broken.json') {
            res.writeHead(200, { 'content-type': 'application/json' });
            res.end('{"name": "truncated"');
            return;
        }

        res.writeHead(404, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not Found' }));
    });

    await new Promise<void>(resolve => upstream.listen(0, '127.0.0.1', () => resolve()));

    const address = upstream.address();
    if (!address || typeof address === 'string') throw new Error('Could not determine upstream address');
    upstreamOrigin = `http://127.0.0.1:${address.port}`;
});

test('PUT: api/basemap - import basemap from text/plain URL', async () => {
    const res = await flight.fetch('/api/basemap', {
        method: 'PUT',
        auth: {
            bearer: flight.token.admin,
        },
        headers: {
            'Content-Type': 'text/plain',
        },
        body: `${upstreamOrigin}/plain-tilejson.json`,
    }, true);

    assert.deepEqual(res.body, {
        type: 'raster',
        name: 'Plain Text Import',
        attribution: 'Unit Test Attribution',
        minzoom: 1,
        maxzoom: 12,
        tiles: ['https://tiles.example.com/plain/{$z}/{$x}/{$y}.png'],
        format: 'png',
    });
});

test('PUT: api/basemap - import basemap from application/json body', async () => {
    const res = await flight.fetch('/api/basemap', {
        method: 'PUT',
        auth: {
            bearer: flight.token.admin,
        },
        body: {
            type: 'raster',
            url: `${upstreamOrigin}/json-tilejson.json`,
        },
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
                    name: 'String',
                },
            },
        ],
        tiles: ['https://tiles.example.com/json/{$z}/{$x}/{$y}.jpg'],
        format: 'jpeg',
    });
});

test('PUT: api/basemap - import WMTS capabilities with RESTful tile template', async () => {
    const res = await flight.fetch('/api/basemap', {
        method: 'PUT',
        auth: {
            bearer: flight.token.admin,
        },
        headers: {
            'Content-Type': 'text/plain',
        },
        body: `${upstreamOrigin}/wmts/nsw/WMTSCapabilities.xml`,
    }, true);

    assert.deepEqual(res.body, {
        type: 'raster',
        name: 'public_NSW_Topo_Map',
        minzoom: 0,
        maxzoom: 18,
        tiles: ['http://maps.six.nsw.gov.au/arcgis/rest/services/public/NSW_Topo_Map/MapServer/WMTS/tile/1.0.0/public_NSW_Topo_Map/default/GoogleMapsCompatible/{$z}/{$y}/{$x}'],
        format: 'png',
        bounds: [140.9992790359442, -37.50833333669615, 159.25666666426426, -28.125000000138627],
        center: [(140.9992790359442 + 159.25666666426426) / 2, (-37.50833333669615 + -28.125000000138627) / 2, 0],
    });
});

test('PUT: api/basemap - import WMTS capabilities with KVP GetTile and prefixed TileMatrix identifiers', async () => {
    const res = await flight.fetch('/api/basemap', {
        method: 'PUT',
        auth: {
            bearer: flight.token.admin,
        },
        headers: {
            'Content-Type': 'text/plain',
        },
        body: `${upstreamOrigin}/wmts/kvp?SERVICE=WMTS&REQUEST=GetCapabilities`,
    }, true);

    assert.deepEqual(res.body, {
        type: 'raster',
        name: 'Parcels',
        attribution: 'Unit Test Provider',
        minzoom: 5,
        maxzoom: 6,
        tiles: ['https://wmts.example.com/geoserver/gwc/service/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=test%3Aparcels&STYLE=parcels-style&FORMAT=image%2Fpng&TILEMATRIXSET=EPSG%3A900913&TILEMATRIX=EPSG%3A900913%3A{$z}&TILEROW={$y}&TILECOL={$x}'],
        format: 'png',
    });
});

test('PUT: api/basemap - import WMTS capabilities selecting a layer by query param', async () => {
    const res = await flight.fetch('/api/basemap', {
        method: 'PUT',
        auth: {
            bearer: flight.token.admin,
        },
        headers: {
            'Content-Type': 'text/plain',
        },
        body: `${upstreamOrigin}/wmts/kvp?SERVICE=WMTS&REQUEST=GetCapabilities&layer=test:roads`,
    }, true);

    assert.equal(res.body.name, 'Roads');
    assert.equal(res.body.minzoom, 4);
    assert.equal(res.body.maxzoom, 6);
    assert.ok(res.body.tiles[0].includes('LAYER=test%3Aroads&STYLE=roads-style'));
});

test('PUT: api/basemap - unknown WMTS layer returns 400', async () => {
    const res = await flight.fetch('/api/basemap', {
        method: 'PUT',
        auth: {
            bearer: flight.token.admin,
        },
        headers: {
            'Content-Type': 'text/plain',
        },
        body: `${upstreamOrigin}/wmts/kvp?SERVICE=WMTS&REQUEST=GetCapabilities&layer=nope`,
    }, false);

    assert.equal(res.status, 400);
    assert.equal(res.body.message, 'WMTS layer "nope" not found in capabilities');
});

test('PUT: api/basemap - WMS capabilities URL returns 400', async () => {
    const res = await flight.fetch('/api/basemap', {
        method: 'PUT',
        auth: {
            bearer: flight.token.admin,
        },
        headers: {
            'Content-Type': 'text/plain',
        },
        body: `${upstreamOrigin}/wms?SERVICE=WMS&REQUEST=GetCapabilities`,
    }, false);

    assert.equal(res.status, 400);
    assert.equal(res.body.message, 'WMS services are not supported - provide a TileJSON, WMTS capabilities, or ArcGIS service URL');
});

test('PUT: api/basemap - HTML page URL returns 400', async () => {
    const res = await flight.fetch('/api/basemap', {
        method: 'PUT',
        auth: {
            bearer: flight.token.admin,
        },
        headers: {
            'Content-Type': 'text/plain',
        },
        body: `${upstreamOrigin}/index.html`,
    }, false);

    assert.equal(res.status, 400);
    assert.equal(res.body.message, 'URL returned XML instead of TileJSON - only TileJSON and WMTS capabilities documents are supported');
});

test('PUT: api/basemap - malformed JSON URL returns 400', async () => {
    const res = await flight.fetch('/api/basemap', {
        method: 'PUT',
        auth: {
            bearer: flight.token.admin,
        },
        headers: {
            'Content-Type': 'text/plain',
        },
        body: `${upstreamOrigin}/broken.json`,
    }, false);

    assert.equal(res.status, 400);
    assert.equal(res.body.message, 'URL did not return a valid TileJSON document');
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
            serverParts: { _text: 'a,b,c' },
        },
    })).to_xml();

    const body = new FormData();
    body.append('file', new Blob([xml], {
        type: 'text/xml',
    }), 'basemap.cot');

    const res = await flight.fetch('/api/basemap', {
        method: 'PUT',
        auth: {
            bearer: flight.token.admin,
        },
        body,
    }, true);

    assert.equal(res.body.type, 'raster');
    assert.equal(res.body.name, 'Multipart Import');
    assert.equal(String(res.body.minzoom), '3');
    assert.equal(String(res.body.maxzoom), '17');
    assert.deepEqual(res.body.tiles, ['https://tiles.example.com/multipart/{z}/{x}/{y}.jpg']);
    assert.equal(res.body.format, 'jpeg');
});

test('PUT: api/basemap - import ArcGIS MapServer layer', async () => {
    const ARCGIS_MAPSERVER_URL = 'https://sampleserver6.arcgisonline.com/arcgis/rest/services/USA/MapServer/1';

    try {
        const res = await flight.fetch('/api/basemap', {
            method: 'PUT',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                type: 'mapserver',
                url: ARCGIS_MAPSERVER_URL,
            },
        }, true);

        assert.equal(res.status, 200);
        assert.ok(Array.isArray(res.body.tiles) && res.body.tiles.length > 0, 'Expected tiles array');
        assert.ok(typeof res.body.name === 'string' && res.body.name.length > 0, 'Expected a non-empty name');
        assert.ok(['raster', 'vector'].includes(res.body.type), `Unexpected type: ${res.body.type}`);
    } catch (err) {
        assert.ifError(err);
    }
});

test('PUT: api/basemap - import ArcGIS FeatureServer layer', async () => {
    const ARCGIS_FEATURESERVER_URL = 'https://services1.arcgis.com/Rlvx5g8pKeK13apH/arcgis/rest/services/Adopted_Districts/FeatureServer/0';

    try {
        const res = await flight.fetch('/api/basemap', {
            method: 'PUT',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                type: 'featureserver',
                url: ARCGIS_FEATURESERVER_URL,
            },
        }, true);

        assert.equal(res.status, 200);
        assert.ok(Array.isArray(res.body.tiles) && res.body.tiles.length > 0, 'Expected tiles array');
        assert.ok(typeof res.body.name === 'string' && res.body.name.length > 0, 'Expected a non-empty name');
        assert.equal(res.body.type, 'vector');
        assert.equal(res.body.format, 'mvt');
    } catch (err) {
        assert.ifError(err);
    }
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

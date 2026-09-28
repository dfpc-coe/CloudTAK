import test from 'node:test';
import assert from 'node:assert';
import { GenerateUpsert } from '@openaddresses/batch-generic';
import AGOLRoute from '../stateless/lib/routing/agol.js';
import AGOLSearch from '../stateless/lib/search/agol.js';
import { RouteManager } from '../stateless/lib/interface-route.js';
import Config from '../common/config.js';
import { testDatabase } from './db.js';

let config: Config;

async function setting(key: string, value: string): Promise<void> {
    await config.models.Setting.generate({ key, value }, { upsert: GenerateUpsert.UPDATE });
}

test('Routing - setup', async () => {
    config = await Config.env({
        postgres: await testDatabase({ reset: false }),
        silent: true,
        noevents: true,
        noetlevents: true,
        nocache: true,
    });
});

test('Routing - constructor', async () => {
    const agol = new AGOLRoute(config);

    assert.equal(agol._id, 'agol');
    assert.equal(agol._name, 'ArcGIS Online');
    assert.equal(agol.tokenManager, undefined);
    assert.equal(new URL(agol.routingApi).host, 'route-api.arcgis.com');
    assert.ok(agol.routingApi.endsWith('/solve'));
    assert.ok(agol.routingApiModes.endsWith('/retrieveTravelModes'));
});

test('Routing - config lists travel modes', async () => {
    const agol = new AGOLRoute(config);

    assert.deepEqual(await agol.config(), { id: 'agol', name: 'ArcGIS Online', modes: [] });

    agol.routeModes.set('1', { id: '1', name: 'Driving Time' } as never);
    agol.routeModes.set('2', { id: '2', name: 'Walking Time' } as never);

    assert.deepEqual(await agol.config(), {
        id: 'agol',
        name: 'ArcGIS Online',
        modes: [{ id: '1', name: 'Driving Time' }, { id: '2', name: 'Walking Time' }],
    });
});

test('Routing - unknown travel mode', async () => {
    const agol = new AGOLRoute(config);

    await assert.rejects(agol.route([[-105, 39.7], [-104.8, 39.9]], 'Teleport'), /Travel Mode not found/);
});

test('Routing - disabled by default', async () => {
    assert.equal(await AGOLRoute.settings(config), null);
    assert.equal(await AGOLRoute.init(config), null);

    const manager = await RouteManager.init(config);
    assert.equal(manager.defaultProvider, null);
    assert.deepEqual(await manager.config(), { enabled: false, providers: [] });

    await assert.rejects(manager.route('agol', [[-105, 39.7], [-104.8, 39.9]]), /Invalid routing provider: agol/);
});

test('Routing - search credentials do not enable routing', async () => {
    await setting('agol::enabled', 'true');
    await setting('agol::auth_method', 'legacy');
    await setting('agol::token', 'search-token');

    assert.ok(await AGOLSearch.init(config), 'Search provider is configured');
    assert.equal(await AGOLRoute.settings(config), null, 'Routing provider is not');
});

test('Routing - enabled without credentials', async () => {
    await setting('routing::agol::enabled', 'true');

    assert.equal(await AGOLRoute.settings(config), null);

    await setting('routing::agol::client_id', 'routing-client');
    assert.equal(await AGOLRoute.settings(config), null, 'OAuth2 requires a client secret');
});

test('Routing - oauth2 credentials', async () => {
    await setting('routing::agol::client_secret', 'routing-secret');

    assert.deepEqual(await AGOLRoute.settings(config), {
        authMethod: 'oauth2',
        clientId: 'routing-client',
        clientSecret: 'routing-secret',
    });
});

test('Routing - legacy credentials', async () => {
    await setting('routing::agol::auth_method', 'legacy');
    assert.equal(await AGOLRoute.settings(config), null, 'Legacy requires a token');

    await setting('routing::agol::token', 'routing-token');

    assert.deepEqual(await AGOLRoute.settings(config), {
        authMethod: 'legacy',
        legacyToken: 'routing-token',
    });
});

test('Routing - disabled with credentials', async () => {
    await setting('routing::agol::enabled', 'false');

    assert.equal(await AGOLRoute.settings(config), null);
});

test('Routing - teardown', async () => {
    await config.pg.end();
});

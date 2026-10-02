import test from 'node:test';
import assert from 'node:assert';
import { GenerateUpsert } from '@openaddresses/batch-generic';
import AGOLRoute from '../stateless/lib/routing/agol.js';
import AGOLSearch from '../stateless/lib/search/agol.js';
import arcgisSettings from '../stateless/lib/search/arcgis-settings.js';
import { RouteManager } from '../stateless/lib/interface-route.js';
import { SearchManager } from '../stateless/lib/interface-search.js';
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
    assert.equal(await arcgisSettings(config, 'routing'), null);
    assert.equal(await arcgisSettings(config, 'search'), null);
    assert.equal(await AGOLRoute.init(config), null);
    assert.equal(await AGOLSearch.init(config), null);

    const manager = await RouteManager.init(config);
    assert.equal(manager.defaultProvider, null);
    assert.deepEqual(await manager.config(), { enabled: false, providers: [] });

    await assert.rejects(manager.route('agol', [[-105, 39.7], [-104.8, 39.9]]), /Invalid routing provider: agol/);
});

test('Routing - search credentials do not enable routing', async () => {
    await setting('search::agol::enabled', 'true');
    await setting('search::agol::auth_method', 'legacy');
    await setting('search::agol::token', 'search-token');

    assert.deepEqual(await arcgisSettings(config, 'search'), {
        authMethod: 'legacy',
        legacyToken: 'search-token',
    });

    assert.ok(await AGOLSearch.init(config), 'Search provider is configured');
    assert.equal(await arcgisSettings(config, 'routing'), null, 'Routing provider is not');

    const search = await SearchManager.init(config);
    assert.equal(search.defaultProvider, 'agol');
    assert.deepEqual((await search.config()).forward.providers, [{ id: 'agol', name: 'ArcGIS Online' }]);

    const routing = await RouteManager.init(config);
    assert.equal(routing.defaultProvider, null);
});

test('Routing - enabled without credentials', async () => {
    await setting('routing::agol::enabled', 'true');

    assert.equal(await arcgisSettings(config, 'routing'), null);

    await setting('routing::agol::client_id', 'routing-client');
    assert.equal(await arcgisSettings(config, 'routing'), null, 'OAuth2 requires a client secret');
});

test('Routing - oauth2 credentials', async () => {
    await setting('routing::agol::client_secret', 'routing-secret');

    assert.deepEqual(await arcgisSettings(config, 'routing'), {
        authMethod: 'oauth2',
        clientId: 'routing-client',
        clientSecret: 'routing-secret',
    });

    assert.deepEqual(await arcgisSettings(config, 'search'), {
        authMethod: 'legacy',
        legacyToken: 'search-token',
    }, 'Search credentials are unchanged');
});

test('Routing - legacy credentials', async () => {
    await setting('routing::agol::auth_method', 'legacy');
    assert.equal(await arcgisSettings(config, 'routing'), null, 'Legacy requires a token');

    await setting('routing::agol::token', 'routing-token');

    assert.deepEqual(await arcgisSettings(config, 'routing'), {
        authMethod: 'legacy',
        legacyToken: 'routing-token',
    });
});

test('Routing - disabled with credentials', async () => {
    await setting('routing::agol::enabled', 'false');

    assert.equal(await arcgisSettings(config, 'routing'), null);
});

test('Search - disabled with credentials', async () => {
    await setting('search::agol::enabled', 'false');

    assert.equal(await arcgisSettings(config, 'search'), null);
    assert.equal(await AGOLSearch.init(config), null);

    const search = await SearchManager.init(config);
    assert.equal(search.has('agol'), false);
});

test('Routing - manager retries a provider that failed to initialize', async (t) => {
    t.mock.timers.enable({ apis: ['Date'] });
    t.mock.method(console, 'error', () => {});

    let calls = 0;

    const manager = new RouteManager(config);
    manager.providers = [{
        name: 'Test',
        load: async () => {
            if (++calls === 1) throw new Error('Provider Offline');

            return new AGOLRoute(config);
        },
    }];

    await manager.refresh();
    assert.equal(calls, 1);
    assert.deepEqual(await manager.config(), { enabled: false, providers: [] });

    await manager.refresh();
    assert.equal(calls, 1, 'Not retried on every request');

    t.mock.timers.tick(30 * 1000);

    await manager.refresh();
    assert.equal(calls, 2);
    assert.equal(manager.defaultProvider, 'agol');
    assert.deepEqual(await manager.config(), {
        enabled: true,
        providers: [{ id: 'agol', name: 'ArcGIS Online', modes: [] }],
    });

    t.mock.timers.tick(30 * 1000);

    await manager.refresh();
    assert.equal(calls, 2, 'Unchanged settings keep the provider');
});

test('Routing - teardown', async () => {
    await config.pg.end();
});

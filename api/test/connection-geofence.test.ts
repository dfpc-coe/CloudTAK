import test from 'node:test';
import assert from 'node:assert';
import ConnectionPool from '../lib/connection-pool.js';
import ConnectionGeofence from '../lib/connection-geofence.js';
import type ConnectionConfig from '../lib/connection-config.js';
import type Config from '../lib/config.js';
import type { Feature } from 'geojson';
import type { Tile38 } from '@iwpnd/tile38-ts';

function feature(id: string): Feature {
    return {
        id,
        type: 'Feature',
        properties: {},
        geometry: {
            type: 'Point',
            coordinates: [-104.9903, 39.7392]
        }
    };
}

test('ConnectionPool.loadGeofences - disabled', async () => {
    let geofencesCalled = false;
    let loadCalled = false;
    const pool = new ConnectionPool({
        wsClients: new Map(),
        geofence: {
            enabled: async () => false,
            load: async () => {
                loadCalled = true;
            }
        }
    } as unknown as Config);

    await pool.loadGeofences({
        id: 1,
        name: 'Test Connection',
        geofences: async () => {
            geofencesCalled = true;
            return [feature('disabled')];
        }
    } as ConnectionConfig);

    await pool.close();

    assert.equal(geofencesCalled, false);
    assert.equal(loadCalled, false);
});

test('ConnectionPool.loadGeofences - disabled by nogeofence', async () => {
    let enabledCalled = false;
    let geofencesCalled = false;
    let loadCalled = false;
    const pool = new ConnectionPool({
        nogeofence: true,
        wsClients: new Map(),
        geofence: {
            enabled: async () => {
                enabledCalled = true;
                return true;
            },
            load: async () => {
                loadCalled = true;
            }
        }
    } as unknown as Config);

    await pool.loadGeofences({
        id: 1,
        name: 'Test Connection',
        geofences: async () => {
            geofencesCalled = true;
            return [feature('disabled')];
        }
    } as ConnectionConfig);

    await pool.close();

    assert.equal(enabledCalled, false);
    assert.equal(geofencesCalled, false);
    assert.equal(loadCalled, false);
});

test('ConnectionPool.loadGeofences - enabled', async () => {
    const expectedFeatures = [feature('enabled')];
    let geofencesCalled = false;
    let loadedConnection: ConnectionConfig | undefined;
    let loadedFeatures: Array<Feature> | undefined;
    const pool = new ConnectionPool({
        wsClients: new Map(),
        geofence: {
            enabled: async () => true,
            load: async (connConfig: ConnectionConfig, features: Array<Feature>) => {
                loadedConnection = connConfig;
                loadedFeatures = features;
            }
        }
    } as unknown as Config);

    await pool.loadGeofences({
        id: 1,
        name: 'Test Connection',
        geofences: async () => {
            geofencesCalled = true;
            return expectedFeatures;
        }
    } as ConnectionConfig);

    await pool.close();

    assert.equal(geofencesCalled, true);
    assert.equal(loadedConnection?.id, 1);
    assert.deepEqual(loadedFeatures, expectedFeatures);
});

test('ConnectionGeofence.load - synchronizes connection geofences to Tile38', async () => {
    const written: Array<{ key: string; id: string; feature: Feature }> = [];
    const scanned: string[] = [];
    const deleted: Array<{ key: string; id: string }> = [];
    const connConfig = {
        id: 1,
        name: 'Test Connection'
    } as ConnectionConfig;
    const geofence = new ConnectionGeofence({
        models: {
            Setting: {
                typedMany: async (defaults: Record<string, unknown>) => {
                    return {
                        ...defaults,
                        'geofence::enabled': true,
                        'geofence::url': 'redis://tile38.example.com:9851'
                    };
                }
            }
        }
    } as unknown as Config);

    geofence.state = 'connected';
    geofence.tile38 = {
        scan: (key: string) => {
            scanned.push(key);
            return {
                noFields: () => {
                    return {
                        asIds: async () => {
                            return {
                                ok: true,
                                elapsed: '0s',
                                ids: ['feature-a', 'feature-old'],
                                count: 2,
                                cursor: 0
                            };
                        }
                    };
                }
            };
        },
        del: async (key: string, id: string) => {
            deleted.push({ key, id });
            return { ok: true, elapsed: '0s' };
        },
        set: (key: string, id: string) => {
            return {
                object: (geojson: Feature) => {
                    return {
                        exec: async () => {
                            written.push({ key, id, feature: geojson });
                            return { ok: true };
                        }
                    };
                }
            };
        }
    } as unknown as Tile38;

    const features = [feature('feature-a'), feature('feature-b')];
    await geofence.load(connConfig, features);

    assert.deepEqual(scanned, ['cloudtak:geofence:1']);
    assert.deepEqual(deleted, [
        { key: 'cloudtak:geofence:1', id: 'feature-old' }
    ]);
    assert.deepEqual(written, [
        { key: 'cloudtak:geofence:1', id: 'feature-a', feature: features[0] },
        { key: 'cloudtak:geofence:1', id: 'feature-b', feature: features[1] }
    ]);
});
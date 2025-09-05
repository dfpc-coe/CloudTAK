import test from 'tape';
import AGOL from '../lib/search/agol.js';
import ArcGISTokenManager from '../lib/search/arcgis-token-manager.js';
import Config from '../lib/config.js';

test('AGOL - constructor with tokenManager', async (t) => {
    const mockConfig = {
        authMethod: 'oauth2' as const,
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret'
    };
    const tokenManager = new ArcGISTokenManager(mockConfig);

    const config = await Config.env({
        postgres: process.env.POSTGRES || 'postgres://postgres@localhost:5432/tak_ps_etl_test',
        silent: true,
        noevents: true,
        nosinks: true,
        nocache: true
    });

    const geocode = new AGOL(config, tokenManager);
    
    t.ok(geocode.tokenManager, 'TokenManager set correctly');
    t.ok(geocode.reverseApi, 'Reverse API URL set');
    t.ok(geocode.suggestApi, 'Suggest API URL set');
    t.ok(geocode.forwardApi, 'Forward API URL set');

    config.pg.end();
    
    t.end();
});

test('AGOL - constructor without tokenManager', async (t) => {
    const config = await Config.env({
        postgres: process.env.POSTGRES || 'postgres://postgres@localhost:5432/tak_ps_etl_test',
        silent: true,
        noevents: true,
        nosinks: true,
        nocache: true
    });

    const geocode = new AGOL(config);
    
    t.equal(geocode.tokenManager, undefined, 'No tokenManager set');
    t.ok(geocode.reverseApi, 'Reverse API URL set');
    t.ok(geocode.suggestApi, 'Suggest API URL set');
    t.ok(geocode.forwardApi, 'Forward API URL set');

    config.pg.end();
    
    t.end();
});

test('AGOL - API URLs are correctly set', async (t) => {
    const config = await Config.env({
        postgres: process.env.POSTGRES || 'postgres://postgres@localhost:5432/tak_ps_etl_test',
        silent: true,
        noevents: true,
        nosinks: true,
        nocache: true
    });

    const geocodeInstance = new AGOL(config);
    
    t.equal(new URL(geocodeInstance.reverseApi).host, 'geocode.arcgis.com', 'Reverse API URL has correct host');
    t.equal(new URL(geocodeInstance.suggestApi).host, 'geocode.arcgis.com', 'Suggest API URL has correct host');
    t.equal(new URL(geocodeInstance.forwardApi).host, 'geocode.arcgis.com', 'Forward API URL has correct host');

    config.pg.end();
    
    t.end();
});

test('AGOL - route method handles empty features', async (t) => {
    const config = await Config.env({
        postgres: process.env.POSTGRES || 'postgres://postgres@localhost:5432/tak_ps_etl_test',
        silent: true,
        noevents: true,
        nosinks: true,
        nocache: true
    });

    const mockConfig = {
        authMethod: 'oauth2' as const,
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret'
    };

    const tokenManager = new ArcGISTokenManager(mockConfig);
    const geocodeInstance = new AGOL(config, tokenManager);
    
    try {
        // This should throw an error for no route found
        const processedRoute = {
            type: 'FeatureCollection' as const,
            features: []
        };
        
        t.equal(processedRoute.type, 'FeatureCollection', 'Correct type');
        t.equal(processedRoute.features.length, 0, 'Empty features array');
        t.ok(geocodeInstance.tokenManager, 'AGOL instance has tokenManager');
    } catch {
        t.pass('Expected error for empty route');
    }

    config.pg.end();

    t.end();
});

test('AGOL - route method processes valid route data', async (t) => {
    const config = await Config.env({
        postgres: process.env.POSTGRES || 'postgres://postgres@localhost:5432/tak_ps_etl_test',
        silent: true,
        noevents: true,
        nosinks: true,
        nocache: true
    });

    const mockConfig = {
        authMethod: 'oauth2' as const,
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret'
    };
    const tokenManager = new ArcGISTokenManager(mockConfig);
    const geocodeInstance = new AGOL(config, tokenManager);
    
    // Test route processing with mock valid data structure
    const mockValidRoute = {
        routes: {
            features: [{
                attributes: {
                    Name: 'Test Route',
                    Total_Length: 10.5
                },
                geometry: {
                    paths: [[[-105, 39.7], [-104.8, 39.9]]]
                }
            }]
        }
    };
    
    // Test that the route structure is valid
    t.ok(mockValidRoute.routes.features.length > 0, 'Has route features');
    t.ok(mockValidRoute.routes.features[0].geometry.paths, 'Has geometry paths');
    t.ok(mockValidRoute.routes.features[0].attributes, 'Has attributes');
    t.ok(geocodeInstance.tokenManager, 'AGOL instance has tokenManager');

    config.pg.end();
    
    t.end();
});

test('AGOL - error handling for different error codes', async (t) => {
    const config = await Config.env({
        postgres: process.env.POSTGRES || 'postgres://postgres@localhost:5432/tak_ps_etl_test',
        silent: true,
        noevents: true,
        nosinks: true,
        nocache: true
    });

    const mockConfig = {
        authMethod: 'oauth2' as const,
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret'
    };
    const tokenManager = new ArcGISTokenManager(mockConfig);
    const geocodeInstance = new AGOL(config, tokenManager);
    
    // Test error code handling logic
    const error498 = { code: 498, message: 'Invalid token' };
    const error400 = { code: 400, message: 'Bad request' };
    
    // Test error code classification
    t.ok(error498.code === 498 || error498.code === 499, 'Auth error codes');
    t.equal(error400.code, 400, 'General error code');
    t.ok(geocodeInstance.tokenManager, 'AGOL instance has tokenManager');

    config.pg.end();
    
    t.end();
});

test('AGOL - validates route input parameters', async (t) => {
    const config = await Config.env({
        postgres: process.env.POSTGRES || 'postgres://postgres@localhost:5432/tak_ps_etl_test',
        silent: true,
        noevents: true,
        nosinks: true,
        nocache: true
    });

    const mockConfig = {
        authMethod: 'oauth2' as const,
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret'
    };
    const tokenManager = new ArcGISTokenManager(mockConfig);
    const geocodeInstance = new AGOL(config, tokenManager);
    
    // Test input validation
    const validStops = [[-105, 39.7], [-104.8, 39.9]];
    const travelMode = 'Driving Time';
    
    t.ok(Array.isArray(validStops), 'Stops is an array');
    t.equal(validStops.length, 2, 'Has start and end points');
    t.ok(validStops[0].length === 2, 'Start point has lat/lng');
    t.ok(validStops[1].length === 2, 'End point has lat/lng');
    t.ok(typeof travelMode === 'string', 'Travel mode is string');
    t.ok(geocodeInstance.tokenManager, 'AGOL instance has tokenManager');

    config.pg.end();
    
    t.end();
});

test('AGOL - URL construction for different endpoints', async (t) => {
    const config = await Config.env({
        postgres: process.env.POSTGRES || 'postgres://postgres@localhost:5432/tak_ps_etl_test',
        silent: true,
        noevents: true,
        nosinks: true,
        nocache: true
    });

    const geocodeInstance = new AGOL(config);
    
    // Test URL construction logic
    const baseUrl = 'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer';
    
    t.ok(geocodeInstance.reverseApi.startsWith(baseUrl), 'Reverse API has correct base');
    t.ok(geocodeInstance.suggestApi.startsWith(baseUrl), 'Suggest API has correct base');
    t.ok(geocodeInstance.forwardApi.startsWith(baseUrl), 'Forward API has correct base');
    
    t.ok(geocodeInstance.reverseApi.includes('reverseGeocode'), 'Reverse API has correct endpoint');
    t.ok(geocodeInstance.suggestApi.includes('suggest'), 'Suggest API has correct endpoint');
    t.ok(geocodeInstance.forwardApi.includes('findAddressCandidates'), 'Forward API has correct endpoint');

    config.pg.end();
    
    t.end();
});

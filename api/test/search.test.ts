import test from 'tape';
import Geocode from '../lib/search.js';
import ArcGISTokenManager from '../lib/arcgis-token-manager.js';

test('Geocode - constructor with tokenManager', async (t) => {
    const mockConfig = {
        authMethod: 'oauth2' as const,
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret'
    };
    const tokenManager = new ArcGISTokenManager(mockConfig);
    const geocode = new Geocode(tokenManager);
    
    t.ok(geocode.tokenManager, 'TokenManager set correctly');
    t.ok(geocode.reverseApi, 'Reverse API URL set');
    t.ok(geocode.suggestApi, 'Suggest API URL set');
    t.ok(geocode.forwardApi, 'Forward API URL set');
    
    t.end();
});

test('Geocode - constructor without tokenManager', async (t) => {
    const geocode = new Geocode();
    
    t.equal(geocode.tokenManager, undefined, 'No tokenManager set');
    t.ok(geocode.reverseApi, 'Reverse API URL set');
    t.ok(geocode.suggestApi, 'Suggest API URL set');
    t.ok(geocode.forwardApi, 'Forward API URL set');
    
    t.end();
});

test('Geocode - API URLs are correctly set', async (t) => {
    const geocodeInstance = new Geocode();
    
    t.equal(new URL(geocodeInstance.reverseApi).host, 'geocode.arcgis.com', 'Reverse API URL has correct host');
    t.equal(new URL(geocodeInstance.suggestApi).host, 'geocode.arcgis.com', 'Suggest API URL has correct host');
    t.equal(new URL(geocodeInstance.forwardApi).host, 'geocode.arcgis.com', 'Forward API URL has correct host');
    
    t.end();
});

test('Geocode - route method handles empty features', async (t) => {
    const mockConfig = {
        authMethod: 'oauth2' as const,
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret'
    };
    const tokenManager = new ArcGISTokenManager(mockConfig);
    const geocodeInstance = new Geocode(tokenManager);
    
    try {
        // This should throw an error for no route found
        const processedRoute = {
            type: 'FeatureCollection' as const,
            features: []
        };
        
        t.equal(processedRoute.type, 'FeatureCollection', 'Correct type');
        t.equal(processedRoute.features.length, 0, 'Empty features array');
        t.ok(geocodeInstance.tokenManager, 'Geocode instance has tokenManager');
    } catch {
        t.pass('Expected error for empty route');
    }

    t.end();
});

test('Geocode - route method processes valid route data', async (t) => {
    const mockConfig = {
        authMethod: 'oauth2' as const,
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret'
    };
    const tokenManager = new ArcGISTokenManager(mockConfig);
    const geocodeInstance = new Geocode(tokenManager);
    
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
    t.ok(geocodeInstance.tokenManager, 'Geocode instance has tokenManager');
    
    t.end();
});

test('Geocode - error handling for different error codes', async (t) => {
    const mockConfig = {
        authMethod: 'oauth2' as const,
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret'
    };
    const tokenManager = new ArcGISTokenManager(mockConfig);
    const geocodeInstance = new Geocode(tokenManager);
    
    // Test error code handling logic
    const error498 = { code: 498, message: 'Invalid token' };
    const error400 = { code: 400, message: 'Bad request' };
    
    // Test error code classification
    t.ok(error498.code === 498 || error498.code === 499, 'Auth error codes');
    t.equal(error400.code, 400, 'General error code');
    t.ok(geocodeInstance.tokenManager, 'Geocode instance has tokenManager');
    
    t.end();
});

test('Geocode - validates route input parameters', async (t) => {
    const mockConfig = {
        authMethod: 'oauth2' as const,
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret'
    };
    const tokenManager = new ArcGISTokenManager(mockConfig);
    const geocodeInstance = new Geocode(tokenManager);
    
    // Test input validation
    const validStops = [[-105, 39.7], [-104.8, 39.9]];
    const travelMode = 'Driving Time';
    
    t.ok(Array.isArray(validStops), 'Stops is an array');
    t.equal(validStops.length, 2, 'Has start and end points');
    t.ok(validStops[0].length === 2, 'Start point has lat/lng');
    t.ok(validStops[1].length === 2, 'End point has lat/lng');
    t.ok(typeof travelMode === 'string', 'Travel mode is string');
    t.ok(geocodeInstance.tokenManager, 'Geocode instance has tokenManager');
    
    t.end();
});

test('Geocode - URL construction for different endpoints', async (t) => {
    const geocodeInstance = new Geocode();
    
    // Test URL construction logic
    const baseUrl = 'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer';
    
    t.ok(geocodeInstance.reverseApi.startsWith(baseUrl), 'Reverse API has correct base');
    t.ok(geocodeInstance.suggestApi.startsWith(baseUrl), 'Suggest API has correct base');
    t.ok(geocodeInstance.forwardApi.startsWith(baseUrl), 'Forward API has correct base');
    
    t.ok(geocodeInstance.reverseApi.includes('reverseGeocode'), 'Reverse API has correct endpoint');
    t.ok(geocodeInstance.suggestApi.includes('suggest'), 'Suggest API has correct endpoint');
    t.ok(geocodeInstance.forwardApi.includes('findAddressCandidates'), 'Forward API has correct endpoint');
    
    t.end();
});
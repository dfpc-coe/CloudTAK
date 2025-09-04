import fetch from '../fetch.js';
import Config from '../config.js';
import { randomUUID } from 'node:crypto';
import { Static } from "@sinclair/typebox";
import { Feature } from '@tak-ps/node-cot';
import { CoTParser } from '@tak-ps/node-cot';
import ArcGISTokenManager from './arcgis-token-manager.js';
import ArcGISConfigService from './arcgis-config.js'
import type { Search } from '../search.js'

export default class AGOLSearch implements Search {
    reverseApi: string;
    suggestApi: string;
    forwardApi: string;
    routingApi: string;

    tokenManager?: ArcGISTokenManager;

    constructor(tokenManager?: ArcGISTokenManager) {
        this.id = 'agol'
        this.name = 'ArcGIS Online';

        this.reverseApi = 'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/reverseGeocode';
        this.suggestApi = 'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/suggest';
        this.forwardApi = 'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates';
        this.routingApi = 'https://route-api.arcgis.com/arcgis/rest/services/World/Route/NAServer/Route_World/solve';

        this.tokenManager = tokenManager;
    }

    async init(config: Config): Promise<AGOLSearch> {
        const configService = ArcGISConfigService.getInstance(config);

        if (!(await configService.isConfigured())) {
            return false;
        }

        const configInstance = await configService.getConfig();
        const tokenManager = new ArcGISTokenManager(configInstance);

        return new Search(tokenManager);
    }

    async config() {
        // TODO Lookup Modes

        return {
            id: this.id,
            name: this.name,
            reverse: {
                supported: true
            },
            forward: {
                supported: true
            },
            route: {
                supported: true,
                modes: []
            }
        }
    }

    async reverse(lon: number, lat: number): Promise<Static<typeof FetchReverse>> {
        const url = new URL(this.reverseApi)
        url.searchParams.append('location', `${lon},${lat}`);
        url.searchParams.append('f', 'json');

        if (this.tokenManager) {
            const token = await this.tokenManager.getValidToken();
            if (token) url.searchParams.append('token', token);
        }

        const res = await fetch(url);
        const body = await res.typed(ReverseContainer);

        if (body.error) {
            if (body.error.code === 498 || body.error.code === 499) {
                throw new Error('ArcGIS authentication failed');
            }
            throw new Error(`ArcGIS API Error: ${body.error.message}`);
        }

        if (!body.address) {
            throw new Error('No address found');
        }

        return body.address;
    }

    async route(
        stops: Array<[number, number]>,
        travelMode?: string
    ): Promise<Static<typeof Feature.FeatureCollection>> {
        const url = new URL(this.routingApi);
        url.searchParams.append('stops', stops.map(stop => stop.join(',')).join(';'));
        url.searchParams.append('f', 'json');

        if (travelMode) url.searchParams.append('travelMode', travelMode);

        if (this.tokenManager) {
            const token = await this.tokenManager.getValidToken();
            if (token) url.searchParams.append('token', token);
        }

        const res = await fetch(url);

        const body = await res.typed(RouteContainer)

        // Check for API errors first
        if (body.error) {
            if (body.error.code === 498 || body.error.code === 499) {
                throw new Error('API not authorized');
            }
            throw new Error(`ArcGIS Routing Error: ${body.error.message}`);
        }

        // Check for routing errors
        if (!body.routes || !body.routes.features || body.routes.features.length === 0) {
            throw new Error('No Route Found');
        }

        const processed: Static<typeof Feature.FeatureCollection> = {
            type: 'FeatureCollection',
            features: []
        }

        if (body.routes?.features) {
            for (const feat of body.routes.features) {
                if (!feat.geometry?.paths?.[0] || !feat.attributes) continue;

                const norm = await CoTParser.normalize_geojson({
                    id: String(randomUUID()),
                    type: 'Feature',
                    properties: {
                        metadata: {
                            ...feat.attributes,
                        }
                    },
                    geometry: {
                        type: 'LineString',
                        coordinates: feat.geometry.paths[0]
                    }
                });

                norm.properties.type = 'b-m-r';
                norm.properties.how = 'm-g';
                norm.properties.callsign = String(feat.attributes.Name);
                norm.properties.archived = true;

                // Add directions as remarks if available
                const directions = body.directions?.[0]?.features?.map(dir => dir.attributes?.text).filter(Boolean).join('\n');
                if (directions) norm.properties.remarks = directions;

                processed.features.push(norm);
            }
        }

        return processed;
    }

    async forward(query: string, magicKey: string, limit?: number): Promise<Array<Static<typeof FetchForward>>> {
        const url = new URL(this.forwardApi)
        url.searchParams.append('magicKey', magicKey);
        url.searchParams.append('singleLine', query);
        if (limit) url.searchParams.append('maxLocations', String(limit));
        url.searchParams.append('f', 'json');

        if (this.tokenManager) {
            const token = await this.tokenManager.getValidToken();
            if (token) url.searchParams.append('token', token);
        }

        const res = await fetch(url);
        const body = await res.typed(ForwardContainer);

        if (body.error) {
            if (body.error.code === 498 || body.error.code === 499) {
                throw new Error('ArcGIS authentication failed');
            }
            throw new Error(`ArcGIS API Error: ${body.error.message}`);
        }

        return body.candidates || [];
    }

    async suggest(query: string, limit?: number, location?: [number, number]): Promise<Array<Static<typeof FetchSuggest>>> {
        const url = new URL(this.suggestApi)
        url.searchParams.append('text', query);
        url.searchParams.append('f', 'json');
        if (limit) url.searchParams.append('maxSuggestions', String(limit));
        if (location) url.searchParams.append('location', `${location[0]},${location[1]}`);

        if (this.tokenManager) {
            const token = await this.tokenManager.getValidToken();
            if (token) url.searchParams.append('token', token);
        }

        const res = await fetch(url);
        const body = await res.typed(SuggestContainer);

        if (body.error) {
            if (body.error.code === 498 || body.error.code === 499) {
                throw new Error('ArcGIS authentication failed');
            }
            throw new Error(`ArcGIS API Error: ${body.error.message}`);
        }

        return body.suggestions || [];
    }
}

import fetch from './fetch.js';
import { randomUUID } from 'node:crypto';
import { Static, Type } from "@sinclair/typebox";
import { EsriExtent, EsriSpatialReference } from './esri/types.js';
import { Feature } from '@tak-ps/node-cot';
import { CoTParser } from '@tak-ps/node-cot';

export const FetchReverse = Type.Object({
    LongLabel: Type.String(),
    ShortLabel: Type.String(),
    Addr_type: Type.String(),
});

const ReverseContainer = Type.Object({
    address: FetchReverse
});

export const RouteContainer = Type.Object({
    checksum: Type.String(),
    requestID: Type.String(),
    routes: Type.Object({
        fieldAliases: Type.Object({}),
        geometryType: Type.String(),
        spatialReference: EsriSpatialReference,
        fields: Type.Array(Type.Object({
            name: Type.String(),
            type: Type.String(),
            alias: Type.String(),
            length: Type.Optional(Type.Integer())
        })),
        features: Type.Array(Type.Object({
            attributes: Type.Record(Type.String(), Type.Union([Type.Number(), Type.String()])),
            geometry: Type.Object({
                paths: Type.Array(Type.Array(Type.Array(Type.Number()))),
            })
        }))
    }),
    directions: Type.Array(Type.Object({
        routeId: Type.Integer(),
        routeName: Type.String(),
        summary: Type.Object({
            totalLength: Type.Number(),
            totalTime: Type.Number(),
            totalDriveTime: Type.Number(),
            envelope: EsriExtent
        }),
        features: Type.Array(Type.Object({
            attributes: Type.Record(Type.String(), Type.Union([Type.Number(), Type.String()])),
            compressedGeometry: Type.String(),
            strings: Type.Array(Type.Object({
                string: Type.String(),
                stringType: Type.String(),
            }))
        }))
    }))
});

export const FetchSuggest = Type.Object({
    text: Type.String(),
    magicKey: Type.String(),
    isCollection: Type.Boolean()
});

export const SuggestContainer = Type.Object({
    suggestions: Type.Array(FetchSuggest)
})

export const FetchForward = Type.Object({
    address: Type.String(),
    location: Type.Object({
        x: Type.Number(),
        y: Type.Number(),
    }),
    score: Type.Integer(),
    attributes: Type.Object({
        LongLabel: Type.Optional(Type.String()),
        ShortLabel: Type.Optional(Type.String()),
    }),
    extent: EsriExtent
});

export const ForwardContainer = Type.Object({
    candidates: Type.Array(FetchForward)
})

export default class Geocode {
    reverseApi: string;
    suggestApi: string;
    forwardApi: string;
    token?: string;

    constructor(token?: string) {
        this.reverseApi = 'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/reverseGeocode';
        this.suggestApi = 'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/suggest';
        this.forwardApi = 'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates'
        this.token = token;
    }

    async reverse(lon: number, lat: number): Promise<Static<typeof FetchReverse>> {
        const url = new URL(this.reverseApi)
        url.searchParams.append('location', `${lon},${lat}`);
        url.searchParams.append('f', 'json');

        const res = await fetch(url);

        const body = await res.typed(ReverseContainer)

        return body.address;
    }

    async route(
        stops: Array<[number, number]>
    ): Promise<Static<typeof Feature.FeatureCollection>> {
        const url = new URL('https://route-api.arcgis.com/arcgis/rest/services/World/Route/NAServer/Route_World/solve');
        url.searchParams.append('stops', stops.map(stop => stop.join(',')).join(';'));
        if (this.token) url.searchParams.append('token', this.token);
        url.searchParams.append('f', 'json');

        const res = await fetch(url);

        const body = await res.typed(RouteContainer)

        const processed: Static<typeof Feature.FeatureCollection> = {
            type: 'FeatureCollection',
            features: []
        }

        for (const feat of body.routes.features) {
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

            processed.features.push(norm);
        }

        return processed;
    }

    async forward(query: string, magicKey: string, limit?: number): Promise<Array<Static<typeof FetchForward>>> {
        const url = new URL(this.forwardApi)
        url.searchParams.append('magicKey', magicKey);
        url.searchParams.append('singleLine', query);
        if (limit) url.searchParams.append('maxLocations', String(limit));
        if (this.token) url.searchParams.append('token', this.token);
        url.searchParams.append('f', 'json');

        const res = await fetch(url);

        const body = await res.typed(ForwardContainer)

        return body.candidates;
    }

    async suggest(query: string, limit?: number): Promise<Array<Static<typeof FetchSuggest>>> {
        const url = new URL(this.suggestApi)
        url.searchParams.append('text', query);
        url.searchParams.append('f', 'json');
        if (limit) url.searchParams.append('maxSuggestions', String(limit));

        const res = await fetch(url);

        const body = await res.typed(SuggestContainer)

        return body.suggestions;
    }
}

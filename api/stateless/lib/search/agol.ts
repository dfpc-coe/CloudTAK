import { fetch } from '@tak-ps/node-safeurl';
import Config from '../../../common/config.js';
import { Static, Type } from '@sinclair/typebox';
import ArcGISTokenManager from './arcgis-token-manager.js';
import arcgisSettings from './arcgis-settings.js';
import { Search } from '../interface-search.js';
import { Search_Type } from '../../../common/enums.js';
import { SearchConfig, FetchSuggest, FetchReverse, FetchForward } from './types.js';

export const AGOLReverse = Type.Object({
    LongLabel: Type.String(),
    ShortLabel: Type.String(),
    Addr_type: Type.String(),
    Type: Type.Optional(Type.String()),
});

export const AGOLForward = Type.Composite([
    Type.Omit(FetchForward, ['type', 'attributes']),
    Type.Object({
        attributes: Type.Object({
            LongLabel: Type.Optional(Type.String()),
            ShortLabel: Type.Optional(Type.String()),
            Addr_type: Type.Optional(Type.String()),
            Type: Type.Optional(Type.String()),
        }),
    }),
]);

export const AGOLReverseContainer = Type.Object({
    address: Type.Optional(AGOLReverse),
    error: Type.Optional(Type.Object({
        code: Type.Number(),
        message: Type.String(),
    })),
});

export const AGOLSuggestContainer = Type.Object({
    suggestions: Type.Optional(Type.Array(Type.Omit(FetchSuggest, ['type']))),
    error: Type.Optional(Type.Object({
        code: Type.Number(),
        message: Type.String(),
    })),
});

export const AGOLForwardContainer = Type.Object({
    candidates: Type.Optional(Type.Array(AGOLForward)),
    error: Type.Optional(Type.Object({
        code: Type.Number(),
        message: Type.String(),
    })),
});

const AGOL_ADDR_TYPES: Record<string, Search_Type> = {
    PointAddress: Search_Type.ADDRESS,
    Subaddress: Search_Type.ADDRESS,
    StreetAddress: Search_Type.ADDRESS,
    StreetAddressExt: Search_Type.ADDRESS,
    StreetName: Search_Type.STREET,
    StreetInt: Search_Type.STREET,
    StreetMidBlock: Search_Type.STREET,
    StreetBetween: Search_Type.STREET,
    DistanceMarker: Search_Type.STREET,
    Postal: Search_Type.POSTAL,
    PostalExt: Search_Type.POSTAL,
    PostalLoc: Search_Type.POSTAL,
};

const AGOL_REGION_TYPES = ['County', 'State or Province', 'Country', 'Region', 'Subregion', 'Territory'];

const AGOL_POI_TYPES: Record<string, Search_Type> = {
    'Hospital': Search_Type.HOSPITAL,
    'Police Station': Search_Type.POLICE,
    'Park': Search_Type.PARK,
    'Nature Reserve': Search_Type.PARK,
    'Wildlife Reserve': Search_Type.PARK,
    'Other Parks and Outdoors': Search_Type.PARK,
    'Mountain': Search_Type.PEAK,
    'Volcano': Search_Type.PEAK,
    'Trail': Search_Type.TRAILHEAD,
    'Parking': Search_Type.PARKING,
};

export function searchType(addrType?: string, type?: string, name?: string): Search_Type | undefined {
    if (!addrType) return undefined;

    if (AGOL_ADDR_TYPES[addrType]) return AGOL_ADDR_TYPES[addrType];

    if (addrType === 'Locality') {
        return type && AGOL_REGION_TYPES.includes(type) ? Search_Type.REGION : Search_Type.LOCALITY;
    }

    if (addrType !== 'POI') return undefined;

    if (name && /\btrailhead\b/i.test(name)) return Search_Type.TRAILHEAD;

    return (type && AGOL_POI_TYPES[type]) || Search_Type.POI;
}

export default class AGOLSearch extends Search {
    reverseApi: string;
    suggestApi: string;
    forwardApi: string;

    tokenManager?: ArcGISTokenManager;

    constructor(
        config: Config,
        tokenManager?: ArcGISTokenManager,
    ) {
        super(config, 'agol', 'ArcGIS Online');

        this.reverseApi = 'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/reverseGeocode';
        this.suggestApi = 'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/suggest';
        this.forwardApi = 'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates';

        this.tokenManager = tokenManager;
    }

    static async init(config: Config): Promise<AGOLSearch | null> {
        const settings = await arcgisSettings(config, 'search');

        if (!settings) return null;

        return new AGOLSearch(config, new ArcGISTokenManager(settings));
    }

    config(): Promise<Static<typeof SearchConfig>> {
        return Promise.resolve({
            id: this._id,
            name: this._name,
            reverse: {
                supported: true,
            },
            forward: {
                supported: true,
            },
        });
    }

    async reverse(lon: number, lat: number): Promise<Static<typeof FetchReverse>> {
        const url = new URL(this.reverseApi);
        url.searchParams.append('location', `${lon},${lat}`);
        url.searchParams.append('f', 'json');

        if (this.tokenManager) {
            const token = await this.tokenManager.getValidToken();
            if (token) url.searchParams.append('token', token);
        }

        const res = await fetch(url);
        const body = await res.typed(AGOLReverseContainer);

        if (body.error) {
            if (body.error.code === 498 || body.error.code === 499) {
                throw new Error('ArcGIS authentication failed');
            }
            throw new Error(`ArcGIS API Error: ${body.error.message}`);
        }

        if (!body.address) {
            throw new Error('No address found');
        }

        const type = searchType(body.address.Addr_type, body.address.Type, body.address.ShortLabel);

        return {
            ...(type ? { type } : {}),
            LongLabel: body.address.LongLabel,
            ShortLabel: body.address.ShortLabel,
            Addr_type: body.address.Addr_type,
        };
    }

    async forward(query: string, magicKey: string, limit?: number): Promise<Array<Static<typeof FetchForward>>> {
        const url = new URL(this.forwardApi);
        url.searchParams.append('magicKey', magicKey);
        url.searchParams.append('singleLine', query);
        if (limit) url.searchParams.append('maxLocations', String(limit));
        url.searchParams.append('outFields', 'Addr_type,Type');
        url.searchParams.append('f', 'json');

        if (this.tokenManager) {
            const token = await this.tokenManager.getValidToken();
            if (token) url.searchParams.append('token', token);
        }

        const res = await fetch(url);
        const body = await res.typed(AGOLForwardContainer);

        if (body.error) {
            if (body.error.code === 498 || body.error.code === 499) {
                throw new Error('ArcGIS authentication failed');
            }
            throw new Error(`ArcGIS API Error: ${body.error.message}`);
        }

        return (body.candidates || []).map(({ attributes, ...candidate }) => {
            const type = searchType(attributes.Addr_type, attributes.Type, candidate.address);

            return {
                ...(type ? { type } : {}),
                ...candidate,
                attributes: {
                    ...(attributes.LongLabel ? { LongLabel: attributes.LongLabel } : {}),
                    ...(attributes.ShortLabel ? { ShortLabel: attributes.ShortLabel } : {}),
                },
            };
        });
    }

    async suggest(query: string, limit?: number, location?: [number, number]): Promise<Array<Static<typeof FetchSuggest>>> {
        const url = new URL(this.suggestApi);
        url.searchParams.append('text', query);
        url.searchParams.append('f', 'json');
        if (limit) url.searchParams.append('maxSuggestions', String(limit));
        if (location) url.searchParams.append('location', `${location[0]},${location[1]}`);

        if (this.tokenManager) {
            const token = await this.tokenManager.getValidToken();
            if (token) url.searchParams.append('token', token);
        }

        const res = await fetch(url);
        const body = await res.typed(AGOLSuggestContainer);

        if (body.error) {
            if (body.error.code === 498 || body.error.code === 499) {
                throw new Error('ArcGIS authentication failed');
            }
            throw new Error(`ArcGIS API Error: ${body.error.message}`);
        }

        return body.suggestions || [];
    }
}

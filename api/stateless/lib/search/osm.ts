import { fetch } from '@tak-ps/node-safeurl';
import Config from '../../../common/config.js';
import { Static, TSchema, Type } from '@sinclair/typebox';
import { Search } from '../interface-search.js';
import { SearchConfig, FetchSuggest, FetchReverse, FetchForward } from './types.js';

export const OSM_PUBLIC_API = 'https://nominatim.openstreetmap.org';

const NominatimPlace = Type.Object({
    place_id: Type.Optional(Type.Integer()),
    osm_type: Type.Optional(Type.String()),
    osm_id: Type.Optional(Type.Integer()),
    lat: Type.String(),
    lon: Type.String(),
    name: Type.Optional(Type.String()),
    display_name: Type.String(),
    addresstype: Type.Optional(Type.String()),
    type: Type.Optional(Type.String()),
    importance: Type.Optional(Type.Number()),
    boundingbox: Type.Optional(Type.Array(Type.String())),
});

const NominatimError = Type.Object({
    error: Type.Union([
        Type.String(),
        Type.Object({
            code: Type.Optional(Type.Integer()),
            message: Type.String(),
        }),
    ]),
});

const NominatimReverse = Type.Union([NominatimError, NominatimPlace]);
const NominatimPlaces = Type.Union([NominatimError, Type.Array(NominatimPlace)]);

const OSM_ID = /^[NWR]\d+$/;

function errorMessage(error: Static<typeof NominatimError>['error']): string {
    return typeof error === 'string' ? error : error.message;
}

function shortLabel(place: Static<typeof NominatimPlace>): string {
    return place.name || place.display_name.split(', ')[0];
}

function magicKey(place: Static<typeof NominatimPlace>): string {
    if (place.osm_type && place.osm_id !== undefined) {
        return `${place.osm_type[0].toUpperCase()}${place.osm_id}`;
    }

    return String(place.place_id ?? '');
}

function extent(place: Static<typeof NominatimPlace>): Static<typeof FetchForward>['extent'] {
    const lon = Number(place.lon);
    const lat = Number(place.lat);
    const pad = 0.005;

    let [ymin, ymax, xmin, xmax] = place.boundingbox && place.boundingbox.length === 4
        ? place.boundingbox.map(Number)
        : [lat, lat, lon, lon];

    if (xmax - xmin < pad) {
        xmin = lon - pad;
        xmax = lon + pad;
    }

    if (ymax - ymin < pad) {
        ymin = lat - pad;
        ymax = lat + pad;
    }

    return { xmin, ymin, xmax, ymax, spatialReference: { wkid: 4326 } };
}

function forward(place: Static<typeof NominatimPlace>): Static<typeof FetchForward> {
    return {
        address: place.display_name,
        location: {
            x: Number(place.lon),
            y: Number(place.lat),
        },
        score: Math.round((place.importance ?? 1) * 100),
        attributes: {
            LongLabel: place.display_name,
            ShortLabel: shortLabel(place),
        },
        extent: extent(place),
    };
}

export default class OSMSearch extends Search {
    api: string;
    userAgent: string;
    throttled: boolean;
    queue: Promise<void>;

    constructor(config: Config, api: string = OSM_PUBLIC_API) {
        super(config, 'osm', 'OpenStreetMap');

        this.api = api.replace(/\/+$/, '');
        this.userAgent = `CloudTAK (${config.API_URL})`;
        this.throttled = new URL(this.api).hostname === new URL(OSM_PUBLIC_API).hostname;
        this.queue = Promise.resolve();
    }

    static async init(config: Config): Promise<OSMSearch | null> {
        const settings = await config.models.Setting.typedMany({
            'osm::enabled': false,
            'osm::url': OSM_PUBLIC_API,
        });

        if (!settings['osm::enabled']) return null;

        return new OSMSearch(config, settings['osm::url'] || OSM_PUBLIC_API);
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
            route: {
                supported: false,
                modes: [],
            },
        });
    }

    async fetch<T extends TSchema>(path: string, params: Record<string, string>, schema: T): Promise<Static<T>> {
        const url = new URL(this.api + path);
        url.searchParams.set('format', 'jsonv2');
        for (const [key, value] of Object.entries(params)) {
            url.searchParams.set(key, value);
        }

        const request = async (): Promise<Static<T>> => {
            const res = await fetch(url, {
                safeUrlAllow: [this.api],
                headers: {
                    'User-Agent': this.userAgent,
                    'Accept': 'application/json',
                },
            });

            if (!res.ok) throw new Error(`Nominatim API failed: ${res.status}`);

            return await res.typed(schema);
        };

        if (!this.throttled) return await request();

        // Public Nominatim usage policy: at most one request per second
        const result = this.queue.then(request);
        this.queue = result.then(() => {}, () => {}).then(() => new Promise(resolve => setTimeout(resolve, 1000)));
        return await result;
    }

    async reverse(lon: number, lat: number): Promise<Static<typeof FetchReverse>> {
        const body = await this.fetch('/reverse', {
            lon: String(lon),
            lat: String(lat),
        }, NominatimReverse);

        if ('error' in body) throw new Error(`Nominatim API Error: ${errorMessage(body.error)}`);

        return {
            LongLabel: body.display_name,
            ShortLabel: shortLabel(body),
            Addr_type: body.addresstype || body.type || 'unknown',
        };
    }

    async forward(query: string, magicKey: string, limit?: number): Promise<Array<Static<typeof FetchForward>>> {
        let body: Static<typeof NominatimPlaces>;

        if (OSM_ID.test(magicKey)) {
            body = await this.fetch('/lookup', { osm_ids: magicKey }, NominatimPlaces);
        } else {
            if (!query.trim()) return [];

            const params: Record<string, string> = { q: query };
            if (limit) params.limit = String(limit);

            body = await this.fetch('/search', params, NominatimPlaces);
        }

        if (!Array.isArray(body)) throw new Error(`Nominatim API Error: ${errorMessage(body.error)}`);

        return body.map(forward);
    }

    async suggest(query: string, limit?: number, location?: [number, number]): Promise<Array<Static<typeof FetchSuggest>>> {
        if (!query.trim()) return [];

        const params: Record<string, string> = { q: query };
        if (limit) params.limit = String(limit);
        if (location) {
            const [lon, lat] = location;
            params.viewbox = [lon - 0.5, lat - 0.5, lon + 0.5, lat + 0.5].join(',');
        }

        const body = await this.fetch('/search', params, NominatimPlaces);

        if (!Array.isArray(body)) throw new Error(`Nominatim API Error: ${errorMessage(body.error)}`);

        return body.map(place => ({
            text: place.display_name,
            magicKey: magicKey(place),
            isCollection: false,
        }));
    }
}

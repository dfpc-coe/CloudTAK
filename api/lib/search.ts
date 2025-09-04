import Config from './config.js';
import Err from '@openaddresses/batch-error';
import { Static, Type } from "@sinclair/typebox";
import { Feature } from '@tak-ps/node-cot';
import AGOL from './search/agol.js';
import { EsriSpatialReference, EsriExtent } from './esri/types.js';

export const SearchConfig = Type.Object({
    id: Type.String(),
    name: Type.String(),
    reverse: Type.Object({
        supported: Type.Boolean(),
    }),
    forward: Type.Object({
        supported: Type.Boolean(),
    }),
    route: Type.Object({
        supported: Type.Boolean(),
        modes: Type.Array(Type.Object({
            id: Type.String(),
            name: Type.String(),
        }))
    })
});

export const SearchManagerConfig = Type.Object({
    reverse: Type.Object({
        enabled: Type.Boolean(),
        providers: Type.Array(Type.Object({
            id: Type.String(),
            name: Type.String(),
        }))
    }),
    route: Type.Object({
        enabled: Type.Boolean(),
        providers: Type.Array(Type.Object({
            id: Type.String(),
            name: Type.String(),
            modes: Type.Array(Type.Object({
                id: Type.String(),
                name: Type.String(),
            }))
        }))
    }),
    forward: Type.Object({
        enabled: Type.Boolean(),
        providers: Type.Array(Type.Object({
            id: Type.String(),
            name: Type.String()
        }))
    })
})

export const FetchReverse = Type.Object({
    LongLabel: Type.String(),
    ShortLabel: Type.String(),
    Addr_type: Type.String(),
});

export const RouteContainer = Type.Object({
    checksum: Type.Optional(Type.String()),
    requestID: Type.Optional(Type.String()),
    error: Type.Optional(Type.Object({
        code: Type.Number(),
        message: Type.String()
    })),
    routes: Type.Optional(Type.Object({
        fieldAliases: Type.Optional(Type.Object({})),
        geometryType: Type.Optional(Type.String()),
        spatialReference: Type.Optional(EsriSpatialReference),
        fields: Type.Optional(Type.Array(Type.Object({
            name: Type.String(),
            type: Type.String(),
            alias: Type.String(),
            length: Type.Optional(Type.Integer())
        }))),
        features: Type.Optional(Type.Array(Type.Object({
            attributes: Type.Optional(Type.Record(Type.String(), Type.Union([Type.Number(), Type.String()]))),
            geometry: Type.Optional(Type.Object({
                paths: Type.Optional(Type.Array(Type.Array(Type.Array(Type.Number()))))
            }))
        }))),
    })),
    directions: Type.Optional(Type.Array(Type.Object({
        routeId: Type.Optional(Type.Integer()),
        routeName: Type.Optional(Type.String()),
        summary: Type.Optional(Type.Object({
            totalLength: Type.Optional(Type.Number()),
            totalTime: Type.Optional(Type.Number()),
            totalDriveTime: Type.Optional(Type.Number()),
            envelope: Type.Optional(EsriExtent)
        })),
        features: Type.Optional(Type.Array(Type.Object({
            attributes: Type.Optional(Type.Record(Type.String(), Type.Union([Type.Number(), Type.String()]))),
            compressedGeometry: Type.Optional(Type.String()),
            strings: Type.Optional(Type.Array(Type.Object({
                string: Type.String(),
                stringType: Type.String()
            })))
        })))
    })))
});

export const FetchSuggest = Type.Object({
    text: Type.String(),
    magicKey: Type.String(),
    isCollection: Type.Boolean()
});

export const SuggestContainer = Type.Object({
    suggestions: Type.Optional(Type.Array(FetchSuggest)),
    error: Type.Optional(Type.Object({
        code: Type.Number(),
        message: Type.String()
    }))
});

export const FetchForward = Type.Object({
    address: Type.String(),
    location: Type.Object({
        x: Type.Number(),
        y: Type.Number(),
    }),
    score: Type.Number(),
    attributes: Type.Object({
        LongLabel: Type.Optional(Type.String()),
        ShortLabel: Type.Optional(Type.String()),
    }),
    extent: EsriExtent
});

export const ForwardContainer = Type.Object({
    candidates: Type.Optional(Type.Array(FetchForward)),
    error: Type.Optional(Type.Object({
        code: Type.Number(),
        message: Type.String()
    }))
});

export class Search implements SearchInterface {
    _id: string;
    _name: string;
    _config: Config;

    constructor(config: Config) {
        this._id = 'generic'
        this._name = 'generic'
        this._config = config;
    }

    static async init(config: Config): Promise<Search | null> {
        return null;
    }

    config(): Promise<Static<typeof SearchConfig>> {
        return Promise.resolve({
            id: '',
            name: '',
            reverse: {
                supported: false
            },
            forward: {
                supported: false
            },
            route: {
                supported: false,
                modes: []
            }
        });
    }
}

/**
 * @class
 *
 * A Generic Search Interface that can be extended to support different geocoding backends
 */
export interface SearchInterface {
    _id: string;
    _name: string;
    _config: Config;

    config(): Promise<Static<typeof SearchConfig>>;

    reverse?(
        lon: number,
        lat: number
    ): Promise<Static<typeof FetchReverse>>;

    route?(
        stops: Array<[number, number]>,
        travelMode?: string
    ): Promise<Static<typeof Feature.FeatureCollection>>;

    forward?(
        query: string,
        magicKey: string,
        limit?: number
    ): Promise<Array<Static<typeof FetchForward>>>;

    suggest?(
        query: string,
        limit?: number,
        location?: [number, number]
    ): Promise<Array<Static<typeof FetchSuggest>>>;
}

/**
 * @class
 * A Manager for different Search providers
 */
export class SearchManager extends Map<string, Search> {
    defaultProvider: string | null;

    constructor() {
        super();
        this.defaultProvider = null;
    }

    static async init(config: Config): Promise<SearchManager> {
        const manager = new SearchManager();

        const agol = await AGOL.init(config);

        if (agol) {
            if (!manager.defaultProvider) {
                manager.defaultProvider = agol._id;
            }

            manager.set(agol._id, agol);
        }

        return manager;
    }

    async config(): Promise<Static<typeof SearchManagerConfig>> {
        const settings: Static<typeof SearchManagerConfig> = {
            reverse: {
                enabled: false,
                providers: []
            },
            route: {
                enabled: false,
                providers: []
            },
            forward: {
                enabled: false,
                providers: []
            }
        };

        for (const search of this.values()) {
            const config = await search.config();

            if (config.reverse.supported) {
                settings.reverse.enabled = true;
                settings.reverse.providers.push({
                    id: config.id,
                    name: config.name
                });
            }

            if (config.forward.supported) {
                settings.forward.enabled = true;
                settings.forward.providers.push({
                    id: config.id,
                    name: config.name
                });
            }

            if (config.route.supported) {
                settings.route.enabled = true;
                settings.route.providers.push({
                    id: config.id,
                    name: config.name,
                    modes: []
                });
            }
        }

        return settings;
    }

    getProvider(provider: string): SearchInterface {
        const search = this.get(provider);

        if (!search) {
            throw new Err(400, null, `Invalid search provider: ${provider}`);
        }

        return search;
    }

    async reverse(
        provider: string,
        lon: number,
        lat: number
    ): Promise<Static<typeof FetchReverse>> {
        const search = this.getProvider(provider);

        if (!search.suggest) throw new Err(400, null, `Search provider ${provider} does not support reverse geocoding`);

        return await search.reverse(lon, lat);
    }

    async route(
        provider: string,
        stops: Array<[number, number]>,
        travelMode?: string
    ): Promise<Static<typeof Feature.FeatureCollection>> {
        const search = this.getProvider(provider);

        if (!search.suggest) throw new Err(400, null, `Search provider ${provider} does not support routing`);

        return await search.route(stops, travelMode);
    }

    async forward(
        provider: string,
        query: string,
        magicKey: string,
        limit?: number
    ): Promise<Array<Static<typeof FetchForward>>> {
        const search = this.getProvider(provider);

        if (!search.suggest) throw new Err(400, null, `Search provider ${provider} does not support forward geocoding`);

        return await search.forward(query, magicKey, limit);
    }

    async suggest(
        provider: string,
        query: string,
        limit?: number,
        location?: [number, number]
    ): Promise<Array<Static<typeof FetchSuggest>>> {
        const search = this.getProvider(provider);

        if (!search.suggest) throw new Err(400, null, `Search provider ${provider} does not support suggestions`);

        return await search.suggest(query, limit, location);
    }
}

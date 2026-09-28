import Config from '../../common/config.js';
import Err from '@openaddresses/batch-error';
import { Static } from '@sinclair/typebox';
import { SearchConfig, SearchProvidersConfig, FetchReverse, FetchSuggest, FetchForward } from './search/types.js';
import { arcgisSettingKeys } from './search/arcgis-settings.js';
import { ProviderManager } from './interface-provider.js';
import type { ProviderLoader, ProviderSettingKey } from './interface-provider.js';

export class Search implements SearchInterface {
    _id: string;
    _name: string;
    _config: Config;

    constructor(config: Config, id: string, name: string) {
        this._id = id;
        this._name = name;
        this._config = config;
    }

    static async init(config: Config): Promise<Search | null> {
        return new Search(config, 'none', 'No Search Provider');
    }

    config(): Promise<Static<typeof SearchConfig>> {
        return Promise.resolve({
            id: '',
            name: '',
            reverse: {
                supported: false,
            },
            forward: {
                supported: false,
            },
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
export class SearchManager extends ProviderManager<Search> {
    label = 'Search';

    settingKeys: ProviderSettingKey[] = [...arcgisSettingKeys('search'), 'osm::enabled', 'osm::url'];

    providers: ProviderLoader<Search>[] = [
        { name: 'AGOL', load: async config => (await import('./search/agol.js')).default.init(config) },
        { name: 'OSM', load: async config => (await import('./search/osm.js')).default.init(config) },
    ];

    static async init(config: Config): Promise<SearchManager> {
        const manager = new SearchManager(config);

        await manager.refresh();

        return manager;
    }

    async config(): Promise<Static<typeof SearchProvidersConfig>> {
        const settings: Static<typeof SearchProvidersConfig> = {
            reverse: {
                enabled: false,
                providers: [],
            },
            forward: {
                enabled: false,
                providers: [],
            },
        };

        for (const search of this.values()) {
            const config = await search.config();

            if (config.reverse.supported) {
                settings.reverse.enabled = true;
                settings.reverse.providers.push({
                    id: config.id,
                    name: config.name,
                });
            }

            if (config.forward.supported) {
                settings.forward.enabled = true;
                settings.forward.providers.push({
                    id: config.id,
                    name: config.name,
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
        lat: number,
    ): Promise<Static<typeof FetchReverse>> {
        const search = this.getProvider(provider);

        if (!search.reverse) throw new Err(400, null, `Search provider ${provider} does not support reverse geocoding`);

        return await search.reverse(lon, lat);
    }

    async forward(
        provider: string,
        query: string,
        magicKey: string,
        limit?: number,
    ): Promise<Array<Static<typeof FetchForward>>> {
        const search = this.getProvider(provider);

        if (!search.forward) throw new Err(400, null, `Search provider ${provider} does not support forward geocoding`);

        return await search.forward(query, magicKey, limit);
    }

    async suggest(
        provider: string,
        query: string,
        limit?: number,
        location?: [number, number],
    ): Promise<Array<Static<typeof FetchSuggest>>> {
        const search = this.getProvider(provider);

        if (!search.suggest) throw new Err(400, null, `Search provider ${provider} does not support suggestions`);

        return await search.suggest(query, limit, location);
    }
}

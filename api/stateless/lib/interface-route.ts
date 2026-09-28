import Config from '../../common/config.js';
import Err from '@openaddresses/batch-error';
import { Static } from '@sinclair/typebox';
import { Feature } from '@tak-ps/node-cot';
import { RouteConfig, RouteManagerConfig } from './routing/types.js';

/**
 * @class
 *
 * A Generic Routing Interface that can be extended to support different routing backends
 */
export interface RouteInterface {
    _id: string;
    _name: string;
    _config: Config;

    config(): Promise<Static<typeof RouteConfig>>;

    route(
        stops: Array<[number, number]>,
        travelMode?: string
    ): Promise<Static<typeof Feature.FeatureCollection>>;
}

/**
 * @class
 * A Manager for different Routing providers
 */
export class RouteManager extends Map<string, RouteInterface> {
    defaultProvider: string | null;

    constructor() {
        super();
        this.defaultProvider = null;
    }

    static async init(config: Config): Promise<RouteManager> {
        const manager = new RouteManager();

        const providers = [
            { name: 'AGOL', load: async () => (await import('./routing/agol.js')).default.init(config) },
        ];

        for (const provider of providers) {
            try {
                const route = await provider.load();

                if (!route) continue;

                if (!manager.defaultProvider) {
                    manager.defaultProvider = route._id;
                }

                manager.set(route._id, route);
            } catch (err) {
                console.error(`not ok - ${provider.name} Routing Provider failed to initialize`, err);
            }
        }

        return manager;
    }

    async config(): Promise<Static<typeof RouteManagerConfig>> {
        const settings: Static<typeof RouteManagerConfig> = {
            enabled: false,
            providers: [],
        };

        for (const route of this.values()) {
            settings.enabled = true;
            settings.providers.push(await route.config());
        }

        return settings;
    }

    async route(
        provider: string,
        stops: Array<[number, number]>,
        travelMode?: string,
    ): Promise<Static<typeof Feature.FeatureCollection>> {
        const route = this.get(provider);

        if (!route) {
            throw new Err(400, null, `Invalid routing provider: ${provider}`);
        }

        return await route.route(stops, travelMode);
    }
}

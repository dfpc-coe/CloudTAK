import Config from '../common/config.js';
import type { ConfigArgs, ConfigInit } from '../common/config.js';
import RemoteHub from './lib/hub/remote.js';
import { UserManager } from './lib/interface-user.js';
import { WeatherManager } from './lib/interface-weather.js';
import type { HubClient } from '../common/hub/index.js';

/**
 * Configuration for the stateless half of the server ('both' and 'api'
 * modes): owns the services request handling needs. The hub client is a
 * RemoteHub against CLOUDTAK_Hub_URL in 'api' mode; in 'both' mode the caller
 * passes the co-located ConfigStateful's LocalHub instead.
 */
export default class ConfigStateless extends Config {
    hub: HubClient;
    user: UserManager;
    weather: WeatherManager;

    constructor(init: ConfigInit, opts: {
        hub?: HubClient;
    } = {}) {
        super(init);

        if (opts.hub) {
            this.hub = opts.hub;
        } else {
            if (!init.hubUrl) throw new Error('CLOUDTAK_Hub_URL must be set when CLOUDTAK_Server_Mode is api');
            this.hub = new RemoteHub(this, init.hubUrl);
        }

        this.user = new UserManager(this);
        this.weather = new WeatherManager();
    }

    static async env(args: ConfigArgs, opts: {
        hub?: HubClient;
    } = {}): Promise<ConfigStateless> {
        const config = new ConfigStateless(await Config.envInit(args), opts);

        await config.user.init();

        return config;
    }
}

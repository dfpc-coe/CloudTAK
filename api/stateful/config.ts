import Config from '../common/config.js';
import type { ConfigArgs, ConfigInit } from '../common/config.js';
import ConnectionPool from './lib/connection-pool.js';
import ConnectionGeofence from './lib/connection-geofence.js';
import EventsPool from './lib/events-pool.js';
import Groups from './lib/groups.js';
import LocalHub from './lib/hub/local.js';
import LocationArbiter, { arbiterModeFromEnv } from './lib/location-arbiter.js';
import type { ConnectionWebSocket } from './lib/connection-web.js';

/**
 * Configuration for the stateful half of the server ('both' and 'hub' modes):
 * owns the in-memory TAK connection pool, geofence, event scheduler and
 * WebSocket client registry, and exposes them in-process through LocalHub.
 */
export default class ConfigStateful extends Config {
    wsClients: Map<string, ConnectionWebSocket[]> = new Map();
    conns: ConnectionPool;
    geofence: ConnectionGeofence;
    events: EventsPool;
    groups: Groups;
    hub: LocalHub;
    /** TAK.NZ: one location broadcaster per user. Mode comes from CLOUDTAK_Location_Arbitration (off | observe | enforce) */
    locationArbiter: LocationArbiter;

    constructor(init: ConfigInit) {
        super(init);

        this.conns = new ConnectionPool(this);
        this.geofence = new ConnectionGeofence(this);
        this.events = new EventsPool(this.StackName);
        this.groups = new Groups(this);
        this.hub = new LocalHub(this);
        this.locationArbiter = new LocationArbiter({}, arbiterModeFromEnv(process.env.CLOUDTAK_Location_Arbitration));
    }

    /** Reconnect the admin connection (connection 0) with the new certificate */
    protected async onAdminCertChanged(): Promise<void> {
        await this.hub.serverRefresh();
    }
    static async env(args: ConfigArgs): Promise<ConfigStateful> {
        return new ConfigStateful(await Config.envInit(args, { migrate: true }));
    }
}

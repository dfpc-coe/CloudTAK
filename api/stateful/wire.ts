import ConnectionPool from './connection-pool.js';
import ConnectionGeofence from './connection-geofence.js';
import EventsPool from './events-pool.js';
import LocalHub from './hub/local.js';
import type Config from '../common/config.js';

/**
 * Stateful (both/hub) wiring. Constructs the in-memory managers and the
 * in-process LocalHub and attaches them to the config. Kept out of
 * common/config.ts so the stateless process never loads this code.
 */
export default function wireLocal(config: Config): void {
    config.attach({
        conns: new ConnectionPool(config),
        geofence: new ConnectionGeofence(config),
        events: new EventsPool(config.StackName),
        hub: new LocalHub(config),
    });
}

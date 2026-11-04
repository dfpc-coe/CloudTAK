import type ConfigStateless from '../config.js';

/**
 * Broadcast a created or updated Core Device as CoT
 *
 * Best effort - a failed immediate submit is recovered by the Admin
 * Connection's next scheduled submit cycle
 */
export function notifyCoreDevice(config: ConfigStateless, id: string): void {
    config.hub.coreEntitySubmit(id).catch((err) => {
        console.error(`not ok - failed to immediately submit Core Device ${id}:`, err);
    });
}

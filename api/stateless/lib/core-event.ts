import type { Static } from '@sinclair/typebox';
import type { CoreEventResponse } from '../../common/types.js';
import type { ETLEventAction } from '../../common/etl-events.js';
import type ConfigStateless from '../config.js';

/**
 * Broadcast a created or updated Core Event as CoT & deliver its ETL Event
 *
 * Best effort - a failed immediate submit is recovered by the Admin
 * Connection's next scheduled submit cycle; an ended Event ages out via stale
 */
export function notifyCoreEvent(config: ConfigStateless, action: ETLEventAction, event: Static<typeof CoreEventResponse>): void {
    config.hub.coreEventSubmit(event.id).catch((err) => {
        console.error(`not ok - failed to immediately submit Core Event ${event.id}:`, err);
    });

    config.etlEvents.event(action, event).catch((err) => {
        console.error(`not ok - failed to deliver ${action} ETL Event for Core Event ${event.id}:`, err);
    });
}

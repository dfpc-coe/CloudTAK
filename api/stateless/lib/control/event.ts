import type { Static } from '@sinclair/typebox';
import Err from '@openaddresses/batch-error';
import { AuthUser, AuthResourceAccess } from '../../../common/auth.js';
import type { AuthResource } from '../../../common/auth.js';
import type { CoreEventResponse } from '../../../common/types.js';
import type ConfigStateless from '../../config.js';
import { userChannels, connectionChannels } from '../tak-channels.js';

/**
 * Access control shared by the Core Event endpoints and the Assignment &
 * Effect endpoints nested beneath them
 */
export default class EventControl {
    config: ConfigStateless;

    constructor(config: ConfigStateless) {
        this.config = config;
    }

    /**
     * Resolve the Connection a Connection or Layer resource token belongs to
     */
    async resourceConnection(auth: AuthResource): Promise<number> {
        if (auth.access === AuthResourceAccess.LAYER) {
            if (auth.id === undefined) throw new Err(401, null, 'Layer Resource Token must contain a Layer ID');
            const layer = await this.config.models.Layer.from(auth.id);
            if (layer.connection === null) throw new Err(401, null, 'Layer is not associated with a Connection');
            return layer.connection;
        } else {
            if (auth.id === undefined) throw new Err(401, null, 'Connection Resource Token must contain a Connection ID');
            const connection = await this.config.models.Connection.from(auth.id);
            return connection.id;
        }
    }

    /**
     * Is the requester the creator of the Event - the user that created it,
     * a System Admin, or a Connection/Layer token belonging to the Connection
     * that created it
     */
    isEventCreator(auth: AuthUser | AuthResource, event: Static<typeof CoreEventResponse>, connection: number | null): boolean {
        if (auth instanceof AuthUser) {
            return auth.is_admin() || event.username === auth.email;
        } else {
            return connection !== null && event.connection === connection;
        }
    }

    /**
     * An Event is visible to its creator, System Admins, any user with an
     * active channel the Event has been shared with, and Connection/Layer
     * tokens belonging to the Connection that created it or whose Connection
     * has an active channel the Event has been shared with - the same rule
     * under which Outgoing Layers are delivered the Event
     */
    async ensureEventAccess(auth: AuthUser | AuthResource, event: Static<typeof CoreEventResponse>, connection: number | null): Promise<void> {
        if (this.isEventCreator(auth, event, connection)) return;

        const shared = (event.channels || []).map(c => Number(c));
        if (shared.length) {
            let active: Set<number> | null = null;

            if (auth instanceof AuthUser) {
                active = await userChannels(this.config, auth.email);
            } else if (connection !== null) {
                active = await connectionChannels(this.config, await this.config.models.Connection.from(connection));
            }

            if (active && shared.some(c => active.has(c))) return;
        }

        throw new Err(403, null, 'You do not have permission to access this Event');
    }

    /**
     * An Event can be edited by anyone that can access it unless its creator
     * has disabled editing, in which case only the creator can edit it
     */
    async ensureEventEditable(auth: AuthUser | AuthResource, event: Static<typeof CoreEventResponse>, connection: number | null): Promise<void> {
        await this.ensureEventAccess(auth, event, connection);

        if (!event.editable && !this.isEventCreator(auth, event, connection)) {
            throw new Err(403, null, 'The Event creator has disabled editing of this Event');
        }
    }
}

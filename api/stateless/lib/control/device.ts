import type { Static } from '@sinclair/typebox';
import { sql } from 'drizzle-orm';
import Err from '@openaddresses/batch-error';
import { AuthUser, AuthResourceAccess } from '../../../common/auth.js';
import type { AuthResource } from '../../../common/auth.js';
import type { CoreDeviceResponse } from '../../../common/types.js';
import type ConfigStateless from '../../config.js';
import { userChannels } from '../tak-channels.js';

/**
 * Access control shared by the Core Device endpoints
 */
export default class DeviceControl {
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
     * Is the requester the creator of the Device - the user that created it,
     * a System Admin, or a Connection/Layer token belonging to the Connection
     * that created it
     */
    isDeviceCreator(auth: AuthUser | AuthResource, device: Static<typeof CoreDeviceResponse>, connection: number | null): boolean {
        if (auth instanceof AuthUser) {
            return auth.is_admin() || device.username === auth.email;
        } else {
            return connection !== null && device.connection === connection;
        }
    }

    /**
     * A Device is visible to its creator, System Admins, any user with an
     * active channel the Device has been shared with, and Connection/Layer
     * tokens belonging to the Connection that created it
     */
    async ensureDeviceAccess(auth: AuthUser | AuthResource, device: Static<typeof CoreDeviceResponse>, connection: number | null): Promise<void> {
        if (this.isDeviceCreator(auth, device, connection)) return;

        if (auth instanceof AuthUser) {
            const shared = (device.channels || []).map(c => Number(c));
            if (shared.length) {
                const active = await userChannels(this.config, auth.email);
                if (shared.some(c => active.has(c))) return;
            }
        }

        throw new Err(403, null, 'You do not have permission to access this Device');
    }

    /**
     * Ensure a Core Event a Device is being assigned to exists
     */
    async ensureEventExists(event: string): Promise<void> {
        const list = await this.config.models.CoreEvent.list({
            limit: 1,
            where: sql`id = ${event}`,
        });

        if (list.total === 0) throw new Err(400, null, 'Assigned Core Event does not exist');
    }
}

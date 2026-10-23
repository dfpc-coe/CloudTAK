import Err from '@openaddresses/batch-error';
import { AuthUser, AuthResourceAccess } from '../../../common/auth.js';
import type { AuthResource } from '../../../common/auth.js';
import type ConfigStateless from '../../config.js';
import { userChannels, connectionChannels } from '../../../common/control/tak-channels.js';

export type EntityKind = 'Event' | 'Device';

/** The columns of a Core Event or Device response that access control and sharing depend on */
export type SharedEntity = {
    username: string | null;
    connection: number | null;
    channels: Array<number>;
    editable: boolean;
};

/**
 * Access control and Channel sharing rules shared by the Core Event & Core
 * Device endpoints and the Assignment & Effect endpoints nested beneath Events
 */
export default class EntityControl {
    config: ConfigStateless;
    kind: EntityKind;

    constructor(config: ConfigStateless, kind: EntityKind) {
        this.config = config;
        this.kind = kind;
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
     * Is the requester the creator of the Entity - the user that created it,
     * a System Admin, or a Connection/Layer token belonging to the Connection
     * that created it
     */
    isCreator(auth: AuthUser | AuthResource, entity: SharedEntity, connection: number | null): boolean {
        if (auth instanceof AuthUser) {
            return auth.is_admin() || entity.username === auth.email;
        } else {
            return connection !== null && entity.connection === connection;
        }
    }

    /**
     * An Entity is visible to its creator, System Admins, any user with an
     * active channel the Entity has been shared with, and Connection/Layer
     * tokens belonging to the Connection that created it or whose Connection
     * has an active channel the Entity has been shared with - the same rule
     * under which Outgoing Layers are delivered the Entity
     */
    async ensureAccess(auth: AuthUser | AuthResource, entity: SharedEntity, connection: number | null): Promise<void> {
        if (this.isCreator(auth, entity, connection)) return;

        const shared = (entity.channels || []).map(c => Number(c));
        if (shared.length) {
            let active: Set<number> | null = null;

            if (auth instanceof AuthUser) {
                active = await userChannels(this.config, auth.email);
            } else if (connection !== null) {
                active = await connectionChannels(this.config, await this.config.models.Connection.from(connection));
            }

            if (active && shared.some(c => active.has(c))) return;
        }

        throw new Err(403, null, `You do not have permission to access this ${this.kind}`);
    }

    /**
     * An Entity can be edited by anyone that can access it unless its creator
     * has disabled editing, in which case only the creator can edit it
     */
    async ensureEditable(auth: AuthUser | AuthResource, entity: SharedEntity, connection: number | null): Promise<void> {
        await this.ensureAccess(auth, entity, connection);

        if (!entity.editable && !this.isCreator(auth, entity, connection)) {
            throw new Err(403, null, `The ${this.kind} creator has disabled editing of this ${this.kind}`);
        }
    }

    /**
     * The active Channels of a Connection - what an Entity of the Connection
     * is shared with when no Channels are chosen for it
     */
    async inheritedChannels(connection: number): Promise<number[]> {
        return Array.from(await connectionChannels(this.config, await this.config.models.Connection.from(connection)));
    }

    /**
     * Channels a new Entity is shared with - a user must choose them, a
     * Connection or Layer token that omits them shares the Entity with the
     * Channels of its Connection
     */
    async createChannels(connection: number | null, requested: number[] | undefined): Promise<number[]> {
        if (requested) return requested;

        if (connection === null) throw new Err(400, null, `channels is required - at least one Channel to share the ${this.kind} with`);

        const channels = await this.inheritedChannels(connection);
        if (!channels.length) throw new Err(400, null, `The Connection has no active Channels to share the ${this.kind} with - provide channels`);

        return channels;
    }

    /**
     * Channels to set on an updated Entity - the requested Channels replace
     * the current ones, and an Entity of a Connection that has none is filled
     * in with the Channels of its Connection so it is never left unshared.
     * Undefined leaves the Entity's Channels as they are
     */
    async fillChannels(entity: SharedEntity, requested: number[] | undefined): Promise<number[] | undefined> {
        if (requested) return requested;
        if (entity.channels.length || entity.connection === null) return undefined;

        const channels = await this.inheritedChannels(entity.connection);
        return channels.length ? channels : undefined;
    }
}

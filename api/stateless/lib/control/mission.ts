import type { Request } from 'express';
import type { Static } from '@sinclair/typebox';
import type { TAKAPI } from '@tak-ps/node-tak';
import type { MissionOptions } from '@tak-ps/node-tak/lib/api/mission';
import Err from '@openaddresses/batch-error';
import { sql } from 'drizzle-orm';
import Auth, { AuthUser, AuthResourceAccess } from '../../../common/auth.js';
import TAKServerControl, { profileUid } from '../../../common/control/takserver.js';
import ProfileOverlayControl from '../../../common/control/profile-overlay.js';
import type ConfigStateless from '../../config.js';

export type MissionContext = {
    user: AuthUser;
    api: TAKAPI;
    opts: Static<typeof MissionOptions>;
};

export type MissionScopedContext = {
    api: TAKAPI;
    opts: Static<typeof MissionOptions>;
    creatorUid: string;
    username: string;
};

/**
 * Request scoped helpers shared by the Marti Mission endpoints
 */
export default class MissionControl {
    config: ConfigStateless;
    takserver: TAKServerControl;
    overlays: ProfileOverlayControl;

    constructor(config: ConfigStateless) {
        this.config = config;
        this.takserver = new TAKServerControl(config);
        this.overlays = new ProfileOverlayControl(config);
    }

    /**
     * Mission auth options for a request - an explicit MissionAuthorization
     * header takes precedence over the token stored on the user's subscription
     */
    async options(req: Request<any, any, any, any>, username: string, guid: string): Promise<Static<typeof MissionOptions>> {
        if (req.headers['missionauthorization']) {
            return { token: String(req.headers['missionauthorization']) };
        }

        return await this.overlays.subscription(username, guid);
    }

    /**
     * Authenticate the requesting user, build a TAK API client with their
     * certificate and resolve the Mission auth options for the given Mission
     */
    async context(req: Request<any, any, any, any>, guid: string, auth: {
        token?: boolean;
    } = {}): Promise<MissionContext> {
        const user = await Auth.as_user(this.config, req, { token: auth.token });
        const api = await this.takserver.asUser(user.email);
        const opts = await this.options(req, user.email, guid);

        return { user, api, opts };
    }

    /**
     * Authenticate a user or a Layer token holding every given scope - a Layer
     * token acts as its Connection, using the token of a Data Sync of that
     * Connection when the Mission is one
     */
    async scoped(req: Request<any, any, any, any>, scope: string | Array<string>, guid?: string, auth: {
        token?: boolean;
    } = {}): Promise<MissionScopedContext> {
        const authed = await Auth.is_auth(this.config, req, {
            token: auth.token,
            resources: [{ access: AuthResourceAccess.LAYER }],
            scope,
        });

        if (authed instanceof AuthUser) {
            return {
                api: await this.takserver.asUser(authed.email),
                opts: guid ? await this.options(req, authed.email, guid) : {},
                creatorUid: profileUid(authed.email),
                username: authed.email,
            };
        }

        const layer = await this.config.models.Layer.from(Number(authed.id));
        if (!layer.connection) throw new Err(400, null, 'Layer is not attached to a Connection');

        const connection = await this.config.models.Connection.from(layer.connection);

        return {
            api: await this.takserver.asConnection(connection),
            opts: guid ? await this.connectionOptions(req, connection.id, guid) : {},
            creatorUid: `connection-${connection.id}-layer-${layer.id}`,
            username: `connection-${connection.id}-layer-${layer.id}`,
        };
    }

    private async connectionOptions(req: Request<any, any, any, any>, connection: number, guid: string): Promise<Static<typeof MissionOptions>> {
        if (req.headers['missionauthorization']) {
            return { token: String(req.headers['missionauthorization']) };
        }

        const data = await this.config.models.Data.list({
            limit: 1,
            where: sql`connection = ${connection} AND (mission_guid = ${guid} OR name = ${guid})`,
        });

        return { token: data.items[0]?.mission_token || undefined };
    }
}

import type { Request } from 'express';
import type { Static } from '@sinclair/typebox';
import type { TAKAPI } from '@tak-ps/node-tak';
import type { MissionOptions } from '@tak-ps/node-tak/lib/api/mission';
import Auth, { AuthUser } from '../../../common/auth.js';
import TAKServerControl from '../../../common/control/takserver.js';
import ProfileOverlayControl from '../../../common/control/profile-overlay.js';
import type ConfigStateless from '../../config.js';

export type MissionContext = {
    user: AuthUser;
    api: TAKAPI;
    opts: Static<typeof MissionOptions>;
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
}

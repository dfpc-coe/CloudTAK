import type { Static } from '@sinclair/typebox';
import type { TAKAPI } from '@tak-ps/node-tak';
import type { Mission, MissionListInput, MissionOptions } from '@tak-ps/node-tak/lib/api/mission';
import Err from '@openaddresses/batch-error';
import { sql } from 'drizzle-orm';
import Auth, { AuthUser, type AnyRequest } from '../../../common/auth.js';
import TAKServerControl, { profileUid } from '../../../common/control/takserver.js';
import ProfileOverlayControl from '../../../common/control/profile-overlay.js';
import type ConfigStateless from '../../config.js';

const MISSION_LIST_PAGE_SIZE = 100;
const MISSION_LIST_MAX_PAGES = 50;

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
    async options(req: AnyRequest, username: string, guid: string): Promise<Static<typeof MissionOptions>> {
        if (req.headers['missionauthorization']) {
            return { token: String(req.headers['missionauthorization']) };
        }

        return await this.overlays.subscription(username, guid);
    }

    /**
     * Build a TAK API client with the requesting user's certificate and
     * resolve the Mission auth options for the given Mission
     */
    async context(req: AnyRequest, guid: string): Promise<MissionContext> {
        const user = await Auth.as_user(this.config, req);
        const api = await this.takserver.asUser(user.email);
        const opts = await this.options(req, user.email, guid);

        return { user, api, opts };
    }

    /**
     * List every Mission the user can see
     *
     * TAK Server's unpaged list (`GET /Marti/api/missions`) takes each Mission from its shared
     * cache, copies it shallowly and then clears the copy's contents when the Mission has a
     * password. The copy shares its collections with the cached Mission, so every list call
     * empties the items, layers and files of every password protected Data Sync for everyone
     * until TAK Server rebuilds the cache entry. The paged list reads from the database instead.
     *
     * Only needed when password protected Data Syncs are requested. Falls back to the unpaged
     * list if the paged endpoint is not available.
     */
    async list(
        api: TAKAPI,
        query: Static<typeof MissionListInput>,
    ): Promise<Static<typeof Mission>[]> {
        if (!query.passwordProtected || query.paged !== undefined) {
            return (await api.Mission.list(query)).data;
        }

        const items = new Map<string, Static<typeof Mission>>();

        try {
            for (let page = 0; page < MISSION_LIST_MAX_PAGES; page++) {
                const res = await api.Mission.list({
                    ...query,
                    // The unpaged list defaults to the public tool, the paged one to every tool
                    tool: query.tool ?? 'public',
                    paged: true,
                    page,
                    pagesize: MISSION_LIST_PAGE_SIZE,
                    // Names are unique, so the order is stable between pages
                    sort: 'name',
                    ascending: true,
                });

                for (const mission of res.data) items.set(mission.guid, mission);

                if (res.data.length < MISSION_LIST_PAGE_SIZE) return Array.from(items.values());
            }

            throw new Err(500, null, 'Too many Data Syncs to list');
        } catch (err) {
            console.error('Paged Data Sync list failed, using the unpaged list', err);
            return (await api.Mission.list(query)).data;
        }
    }

    /**
     * Refuse a change that would leave a Mission without an owner
     *
     * A Mission with no owner subscription can no longer have its roles, groups or
     * password changed, and a CloudTAK admin has no access to a Mission they are
     * not subscribed to. Only enforced while the Mission has an owner.
     *
     * `changes` lists subscribers being demoted or removed (`role` omitted means
     * removed). It mirrors how TAK Server picks the rows a role change touches:
     * with a `username` every subscription row of that username is changed,
     * otherwise only the row of the `clientUid`.
     */
    async assertOwnerRemains(
        api: TAKAPI,
        guid: string,
        changes: Array<{ clientUid: string; username?: string; role?: string }>,
        opts: Static<typeof MissionOptions>,
    ): Promise<void> {
        const subscribers = await api.Mission.subscriptionRoles(guid, opts);

        const owners = subscribers.data.filter(subscriber => subscriber.role.type === 'MISSION_OWNER');

        if (!owners.length) return;

        const demoted = changes.filter(change => change.role !== 'MISSION_OWNER');

        const remaining = owners.filter((owner) => {
            return !demoted.some((change) => {
                return change.username
                    ? owner.username === change.username
                    : owner.clientUid === change.clientUid;
            });
        });

        if (!remaining.length) {
            throw new Err(409, null, 'A Data Sync must keep at least one owner');
        }
    }

    /**
     * Build a TAK API client for the user or Layer token the route authorized -
     * a Layer token acts as its Connection, using the token of a Data Sync of
     * that Connection when the Mission is one
     */
    async scoped(req: AnyRequest, guid?: string): Promise<MissionScopedContext> {
        const authed = await Auth.is_auth(this.config, req);

        if (authed instanceof AuthUser) {
            return {
                api: await this.takserver.asUser(authed.email),
                opts: guid ? await this.options(req, authed.email, guid) : {},
                creatorUid: profileUid(authed.email),
                username: authed.email,
            };
        }

        const layer = await Auth.layer(this.config, authed);
        if (!layer.connection) throw new Err(400, null, 'Layer is not attached to a Connection');

        const connection = await this.config.models.Connection.from(layer.connection);

        return {
            api: await this.takserver.asConnection(connection),
            opts: guid ? await this.connectionOptions(req, connection.id, guid) : {},
            creatorUid: `connection-${connection.id}-layer-${layer.id}`,
            username: `connection-${connection.id}-layer-${layer.id}`,
        };
    }

    private async connectionOptions(req: AnyRequest, connection: number, guid: string): Promise<Static<typeof MissionOptions>> {
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

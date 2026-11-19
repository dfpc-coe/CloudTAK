import Err from '@openaddresses/batch-error';
import Config from '../../common/config.js';
import { Static } from '@sinclair/typebox';
import { Agency, MachineUser, Channel, ChannelAccessEnum } from './interface-user.js';
import crypto from 'crypto';
import { sql } from 'drizzle-orm';
import { TAKAPI, APIAuthPassword } from '@tak-ps/node-tak';
import { TAKGroup, TAKRole } from '@tak-ps/node-tak/lib/api/types';
import pem from 'pem';
import xmljs from 'xml-js';

/** Authentik API payloads - third party JSON, only the fields read here are typed */
interface AuthentikGroup {
    pk?: string;
    num_pk?: number;
    name: string;
    attributes?: {
        agencyId?: number;
        agencyName?: string;
        description?: string;
        channelId?: number;
        channelName?: string;
        [key: string]: unknown;
    };
    [key: string]: unknown;
}
interface AuthentikUser {
    pk: number;
    username: string;
    email?: string;
    name?: string;
    groups?: Array<string>;
    attributes?: { takCallsign?: string; takColor?: unknown; takRole?: unknown; [key: string]: unknown };
    [key: string]: unknown;
}
interface AuthentikPage<T> {
    results: Array<T>;
    pagination?: { next?: number };
}

const TAK_GROUPS: ReadonlySet<string> = new Set(Object.values(TAKGroup));
const TAK_ROLES: ReadonlySet<string> = new Set(Object.values(TAKRole));

/**
 * Authentik user attributes are free-text, admin-editable strings - they are
 * not guaranteed to be one of CloudTAK's enum values. A bad value (an unset
 * attribute serialised as the literal string "None" by an external script,
 * a typo, a stale value from a renamed team colour, etc.) must not reach
 * ProfileConfig: `tak_group`/`tak_role` are stored as free text but the
 * `GET /api/profile` response schema validates them against TAKGroup/TAKRole
 * (see api/common/types.ts), so a single bad write poisons the profile and
 * every subsequent profile fetch starts returning 400 until someone finds
 * and corrects the row by hand. Validate at the boundary instead: drop an
 * attribute that is not a recognised enum value rather than passing it
 * through, so `login.ts`'s "only set if truthy" logic leaves the existing,
 * previously-valid value untouched.
 */
export function asTakGroup(value: unknown, username: string): string | undefined {
    if (typeof value !== 'string' || !value) return undefined;
    if (TAK_GROUPS.has(value)) return value;

    console.error(`Authentik attribute takColor="${value}" for ${username} is not a valid TAK team colour - ignoring`);
    return undefined;
}

export function asTakRole(value: unknown, username: string): string | undefined {
    if (typeof value !== 'string' || !value) return undefined;
    if (TAK_ROLES.has(value)) return value;

    console.error(`Authentik attribute takRole="${value}" for ${username} is not a valid TAK role - ignoring`);
    return undefined;
}

/**
 * The caller's agency authorization scope, resolved at the route from the
 * CloudTAK profile (system_admin / agency_admin). It is passed into the
 * provider so agency/channel listings can be filtered to what the caller may
 * see, independent of any route-level gate (defense in depth).
 *
 * - `{ all: true }`  — system admin: no filtering.
 * - `{ all: false, agencyIds }` — scoped to the given agency ids. An empty set
 *   means "no agencies" and yields empty results.
 */
export type AgencyScope = { all: true } | { all: false; agencyIds: ReadonlySet<number> };

/** Convenience: system-admin scope (sees everything). */
export const SCOPE_ALL: AgencyScope = { all: true };

/** Build a scoped AgencyScope from a list of agency ids. */
export function agencyScope(agencyIds: Array<number>): AgencyScope {
    return { all: false, agencyIds: new Set(agencyIds) };
}

/**
 * Is an agency (identified by its own `agencyId`) visible under this scope?
 * System-admin scope sees everything; otherwise the id must be in the set.
 * The id is coerced with Number() because Authentik attributes are free-text
 * and may arrive as a numeric string.
 */
export function agencyInScope(scope: AgencyScope, agencyId: unknown): boolean {
    if (scope.all) return true;
    const id = Number(agencyId);
    return Number.isFinite(id) && scope.agencyIds.has(id);
}

/**
 * All ETL machine-user service accounts are named with this prefix. It is both
 * the creation convention (see machineUsernameFor) and the guard used to avoid
 * ever deleting a non-ETL account (see isMachineUser).
 */
export const MACHINE_USER_PREFIX = 'etl-';

/**
 * Canonical Authentik username for a connection's machine user:
 *   etl-agency{agencyId}-{sanitised-name}   (agency-owned)
 *   etl-{sanitised-name}                    (no agency)
 * This is the single source of truth for the naming convention, used at both
 * create and delete time so they can never drift.
 */
export function machineUsernameFor(name: string, agencyId?: number | null): string {
    const agencyPrefix = agencyId ? `agency${agencyId}-` : '';
    const sanitised = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    return `${MACHINE_USER_PREFIX}${agencyPrefix}${sanitised}`;
}

/**
 * Extract the machine username from an X.509 certificate subject string. TAK
 * Server issues the machine user's client cert with the Authentik username as
 * the CN, so the connection's stored certificate is an authoritative record of
 * which account it belongs to - more reliable than re-deriving from the
 * (mutable) connection name at delete time. Returns undefined if no CN is
 * present. Handles both "CN=x, O=y" and "CN=x\nO=y" subject renderings.
 */
export function machineUsernameFromCertSubject(subject: string | undefined | null): string | undefined {
    if (!subject) return undefined;
    const match = subject.split(/[,\n]/).map(s => s.trim()).find(s => s.toUpperCase().startsWith('CN='));
    if (!match) return undefined;
    const cn = match.slice(3).trim();
    return cn || undefined;
}

/**
 * Is this Authentik user an ETL machine user we are allowed to delete? We can
 * not rely on a `machineUser` attribute (the service_account create endpoint
 * drops custom attributes), so identify by service-account type plus the
 * `etl-` username convention. Both must hold to avoid deleting a human.
 */
export function isMachineUser(user: { type?: string; username?: string }): boolean {
    return user.type === 'service_account'
        && typeof user.username === 'string'
        && user.username.startsWith(MACHINE_USER_PREFIX);
}

/**
 * Does an Authentik service-account create response indicate the username is
 * already taken? Authentik returns 400 with a body like
 * {"name":["This field must be unique."]}. Because the machine-user username is
 * derived deterministically from the connection name + agency, a duplicate
 * means a machine user for this connection already exists - which we want to
 * report as an actionable 409, not an opaque 500.
 */
export function isDuplicateUsernameError(status: number, body: string): boolean {
    return status === 400 && /must be unique/i.test(body);
}

/**
 * Resolve the Authentik channel-group name for a base channel + access level.
 *   duplex -> tak_<Channel>          (base group; read + write)
 *   read   -> tak_<Channel>_READ
 *   write  -> tak_<Channel>_WRITE
 * `baseName` is the group name WITHOUT the channel prefix (i.e. the `rdn`).
 * The _READ / _WRITE variant groups are managed externally (TAK Server side)
 * and carry no attributes of their own - all channel metadata lives on the
 * base duplex group.
 */
export function channelGroupName(prefix: string, baseName: string, access: string): string {
    const base = `${prefix}${baseName}`;
    switch (access.toLowerCase()) {
        case ChannelAccessEnum.read: return `${base}_READ`;
        case ChannelAccessEnum.write: return `${base}_WRITE`;
        default: return base; // duplex
    }
}

export default class AuthentikProvider {
    config: Config;
    authentikUrl: string;
    tokenArn: string;
    cache?: { expires: Date; token: string };

    constructor(config: Config, authentikUrl: string, tokenArn: string) {
        this.config = config;
        this.authentikUrl = authentikUrl;
        this.tokenArn = tokenArn;
    }

    get configured(): boolean {
        return !!(this.authentikUrl && this.tokenArn);
    }

    static async init(config: Config): Promise<AuthentikProvider> {
        const authentikUrl = process.env.AUTHENTIK_URL || '';
        const tokenArn = process.env.AUTHENTIK_API_TOKEN_SECRET_ARN || '';

        if (!authentikUrl) {
            throw new Err(500, null, 'AUTHENTIK_URL not configured');
        }

        if (!tokenArn) {
            throw new Err(500, null, 'AUTHENTIK_API_TOKEN_SECRET_ARN not configured');
        }

        return new AuthentikProvider(config, authentikUrl, tokenArn);
    }

    async auth(): Promise<{ expires: Date; token: string }> {
        if (!this.cache || this.cache.expires < new Date()) {
            const AWS = await import('@aws-sdk/client-secrets-manager');
            const client = new AWS.SecretsManagerClient({});
            const response = await client.send(
                new AWS.GetSecretValueCommand({ SecretId: this.tokenArn }),
            );

            const token = response.SecretString || '';
            const expires = new Date();
            expires.setHours(expires.getHours() + 1);

            this.cache = { token, expires };
        }

        return this.cache;
    }

    /**
     * Fetch every Authentik group across all pages of `/api/v3/core/groups/`.
     *
     * Authentik paginates this endpoint (default page size ~20-100), returning
     * only one page per request along with a `pagination.next` page number
     * (0 when there is no next page). Reading only `data.results` from the
     * first request silently drops every group beyond page one, which meant
     * agencies/channels defined later in the alphabetical ordering never
     * appeared in CloudTAK. This walks the `pagination.next` links until they
     * run out and concatenates the results.
     *
     * `search` is forwarded to Authentik verbatim when provided. The larger
     * `page_size` reduces the number of round-trips for the common case.
     */
    private async fetchAllGroups(token: string, search?: string): Promise<AuthentikGroup[]> {
        const results: AuthentikGroup[] = [];
        let page = 1;

        for (;;) {
            const url = new URL('/api/v3/core/groups/', this.authentikUrl);
            if (search) url.searchParams.append('search', search);
            url.searchParams.append('page', String(page));
            url.searchParams.append('page_size', '100');

            const response = await fetch(url, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: 'application/json',
                },
            });

            if (!response.ok) throw new Err(500, new Error(await response.text()), 'Authentik Groups Fetch Error');

            const data = await response.json() as AuthentikPage<AuthentikGroup>;
            if (Array.isArray(data.results)) results.push(...data.results);

            const next = data.pagination?.next;
            if (!next || next === page) break;
            page = next;
        }

        return results;
    }

    async agencies(uid: number, filter: string, scope: AgencyScope = SCOPE_ALL): Promise<{
        total: number;
        items: Array<Static<typeof Agency>>;
    }> {
        const creds = await this.auth();

        const agencyPrefix = process.env.OIDC_AGENCY_ADMIN_GROUP_PREFIX || 'CloudTAKAgency';

        const groups = await this.fetchAllGroups(creds.token, filter);
        let filteredResults = groups.filter((g: AuthentikGroup) => g.name.startsWith(agencyPrefix));

        // Defense in depth: even if a route forgets to gate, a non-system-admin
        // only ever sees the agencies they administer. agencyId is the agency
        // group's own id (see interface-user mapping); compare numerically.
        if (!scope.all) {
            filteredResults = filteredResults.filter((g: AuthentikGroup) =>
                agencyInScope(scope, g.attributes?.agencyId),
            );
        }

        return {
            total: filteredResults.length,
            items: filteredResults.map((g: AuthentikGroup) => ({
                id: g.attributes?.agencyId || 0,
                name: g.attributes?.agencyName || g.name,
                description: g.attributes?.description || '',
            })),
        };
    }

    async agency(uid: number, agencyId: number, scope: AgencyScope = SCOPE_ALL): Promise<Static<typeof Agency>> {
        // Defense in depth: a non-system-admin may only look up an agency they
        // administer. Treated as 404 (not 403) to avoid confirming existence of
        // agencies the caller has no business knowing about.
        if (!agencyInScope(scope, agencyId)) {
            throw new Err(404, null, 'Agency not found');
        }

        const creds = await this.auth();

        const agencyPrefix = process.env.OIDC_AGENCY_ADMIN_GROUP_PREFIX || 'CloudTAKAgency';

        const url = new URL('/api/v3/core/groups/', this.authentikUrl);
        url.searchParams.append('name', `${agencyPrefix}${agencyId}`);

        const response = await fetch(url, {
            headers: {
                Authorization: `Bearer ${creds.token}`,
                Accept: 'application/json',
            },
        });

        if (!response.ok) throw new Err(500, new Error(await response.text()), 'Authentik Agency Fetch Error');

        const data = await response.json() as AuthentikPage<AuthentikGroup>;
        const group = data.results[0];

        if (!group) throw new Err(404, null, 'Agency not found');

        return {
            id: group.attributes?.agencyId || agencyId,
            name: group.attributes?.agencyName || group.name,
            description: group.attributes?.description || '',
        };
    }

    async createMachineUser(uid: number, body: {
        name: string;
        agency_id?: number;
        password: string;
        integration: { description?: string; [key: string]: unknown };
    }): Promise<Static<typeof MachineUser>> {
        const creds = await this.auth();

        const userUrl = new URL('/api/v3/core/users/', this.authentikUrl);
        userUrl.searchParams.append('pk', String(uid));
        const userResponse = await fetch(userUrl, {
            headers: {
                Authorization: `Bearer ${creds.token}`,
                Accept: 'application/json',
            },
        });

        if (!userResponse.ok) throw new Err(500, new Error(await userResponse.text()), 'Authentik User Fetch Error');
        const creatorData = await userResponse.json() as AuthentikPage<AuthentikUser>;
        const creatorUsername = creatorData.results[0]?.username || 'unknown';

        const agencyPrefix = body.agency_id ? `agency${body.agency_id}-` : '';
        const username = `etl-${agencyPrefix}${body.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;

        const createUrl = new URL('/api/v3/core/users/service_account/', this.authentikUrl);
        const createResponse = await fetch(createUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${creds.token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({
                name: username,
                username: username,
                attributes: {
                    machineUser: true,
                    agencyId: body.agency_id || null,
                    createdBy: creatorUsername,
                    createdAt: new Date().toISOString(),
                    description: body.integration.description,
                },
            }),
        });

        if (!createResponse.ok) {
            const errorText = await createResponse.text();

            // A service account with this username already exists. Authentik
            // returns 400 {"name":["This field must be unique."]}. The username
            // is derived deterministically from the connection name + agency, so
            // this happens when a machine user for the same connection already
            // exists (e.g. a leftover from a previous connection, or a retry).
            // Surface an actionable 409 instead of an opaque 500 so the user
            // knows to remove the existing machine user / connection first.
            if (isDuplicateUsernameError(createResponse.status, errorText)) {
                throw new Err(409, null, `A machine user "${username}" already exists. Delete the existing connection or machine user before creating a new one.`);
            }

            throw new Err(500, new Error(errorText), 'Authentik Service Account Creation Error');
        }

        const userData = await createResponse.json() as { user_pk: number };
        const userId = userData.user_pk;

        const passwordUrl = new URL(`/api/v3/core/users/${userId}/set_password/`, this.authentikUrl);
        const passwordResponse = await fetch(passwordUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${creds.token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ password: body.password }),
        });

        if (!passwordResponse.ok) throw new Err(500, new Error(await passwordResponse.text()), 'Authentik Password Set Error');

        return {
            id: userId,
            email: username,
            integrations: [],
        };
    }

    async fetchMachineUser(uid: number, email: string): Promise<Static<typeof MachineUser>> {
        const creds = await this.auth();

        const url = new URL('/api/v3/core/users/', this.authentikUrl);
        url.searchParams.append('username', email);

        const response = await fetch(url, {
            headers: {
                Authorization: `Bearer ${creds.token}`,
                Accept: 'application/json',
            },
        });

        if (!response.ok) throw new Err(500, new Error(await response.text()), 'Authentik User Fetch Error');

        const data = await response.json() as AuthentikPage<AuthentikUser>;
        const user = data.results[0];

        if (!user) throw new Err(404, null, 'Machine user not found');

        return {
            id: user.pk,
            email: user.username,
            integrations: [],
        };
    }

    async updateMachineUser(uid: number, mid: number, body: {
        password?: string;
    }): Promise<Static<typeof MachineUser>> {
        const creds = await this.auth();

        if (body.password) {
            const url = new URL(`/api/v3/core/users/${mid}/set_password/`, this.authentikUrl);
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${creds.token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ password: body.password }),
            });

            if (!response.ok) throw new Err(500, new Error(await response.text()), 'Authentik Password Update Error');
        }

        return {
            id: mid,
            email: '',
            integrations: [],
        };
    }

    async channels(uid: number, query: {
        filter: string;
        agency?: number;
    }, scope: AgencyScope = SCOPE_ALL): Promise<{
        total: number;
        items: Array<Static<typeof Channel>>;
    }> {
        const creds = await this.auth();
        const channelPrefix = process.env.AUTHENTIK_CHANNEL_GROUP_PREFIX || 'tak_';

        const groups = await this.fetchAllGroups(creds.token, query.filter);

        // A channel is represented by its BASE (duplex) group. The _READ /
        // _WRITE variants are access grants, not channels in their own right,
        // so they must not appear as separate list entries. Track which variant
        // names exist so we can advertise the available access levels per
        // channel.
        const groupNames = new Set<string>(groups.map((g: AuthentikGroup) => g.name));
        let channels = groups.filter((g: AuthentikGroup) =>
            g.name.startsWith(channelPrefix)
            && !g.name.endsWith('_READ')
            && !g.name.endsWith('_WRITE'),
        );

        // On a tak_* channel group, agencyId is a FOREIGN KEY to the owning
        // agency (not the channel's own id). Restrict to channels owned by an
        // agency in scope before honouring the client-supplied agency filter,
        // so a non-system-admin can never enumerate channels outside their
        // agencies regardless of the query param they pass.
        if (!scope.all) {
            channels = channels.filter((g: AuthentikGroup) =>
                agencyInScope(scope, g.attributes?.agencyId),
            );
        }

        if (query.agency) {
            channels = channels.filter((g: AuthentikGroup) => g.attributes?.agencyId === query.agency);
        }

        return {
            total: channels.length,
            items: channels.map((g: AuthentikGroup) => {
                const rdn = g.name.slice(channelPrefix.length);

                // Duplex is always available (it is the base group itself);
                // read/write only if their variant groups are provisioned.
                const access: ChannelAccessEnum[] = [ChannelAccessEnum.duplex];
                if (groupNames.has(`${g.name}_READ`)) access.push(ChannelAccessEnum.read);
                if (groupNames.has(`${g.name}_WRITE`)) access.push(ChannelAccessEnum.write);

                return {
                    id: g.attributes?.channelId || g.num_pk || 0,
                    rdn,
                    name: g.attributes?.channelName || rdn,
                    description: g.attributes?.description || '',
                    access,
                };
            }),
        };
    }

    async attachMachineUser(uid: number, body: {
        machine_id: number;
        channel_id: number;
        access: string;
    }): Promise<void> {
        const creds = await this.auth();
        const channelPrefix = process.env.AUTHENTIK_CHANNEL_GROUP_PREFIX || 'tak_';

        const groups = await this.fetchAllGroups(creds.token);

        // The channel is identified by the BASE (duplex) group, which is the
        // only variant carrying channelId/channelName. Its `rdn` (name without
        // the prefix) is what the _READ / _WRITE variant names are built from.
        const baseGroup = groups.find((g: AuthentikGroup) =>
            g.name.startsWith(channelPrefix)
            && (g.attributes?.channelId === body.channel_id || g.num_pk === body.channel_id),
        );

        if (!baseGroup) throw new Err(404, null, `Channel ${body.channel_id} not found`);

        // Map the requested access level to the concrete group name:
        //   duplex -> base group, read -> _READ, write -> _WRITE.
        const rdn = baseGroup.name.slice(channelPrefix.length);
        const targetName = channelGroupName(channelPrefix, rdn, body.access);
        const targetGroup = groups.find((g: AuthentikGroup) => g.name === targetName);

        // The _READ / _WRITE variant groups are provisioned externally (TAK
        // Server side). If the requested access level's group does not exist we
        // must NOT silently fall back to the base group - that would grant more
        // access than asked. Fail with a clear, actionable message instead.
        if (!targetGroup) {
            throw new Err(422, null, `Channel "${rdn}" is not configured for ${body.access} access (missing group "${targetName}")`);
        }

        const url = new URL(`/api/v3/core/groups/${targetGroup.pk}/add_user/`, this.authentikUrl);
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${creds.token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ pk: body.machine_id }),
        });

        if (!response.ok) throw new Err(500, new Error(await response.text()), 'Authentik User Group Assignment Error');
    }

    async updateIntegrationConnectionId(): Promise<void> {
        return;
    }

    async deleteIntegrationByConnectionId(): Promise<void> {
        return;
    }

    async deleteMachineUser(username: string): Promise<void> {
        try {
            const creds = await this.auth();

            // Fetch user by username
            const url = new URL('/api/v3/core/users/', this.authentikUrl);
            url.searchParams.append('username', username);

            const response = await fetch(url, {
                headers: {
                    Authorization: `Bearer ${creds.token}`,
                    Accept: 'application/json',
                },
            });

            if (!response.ok) {
                console.error(`Failed to fetch machine user ${username}:`, await response.text());
                return;
            }

            const data = await response.json() as AuthentikPage<AuthentikUser>;
            const user = data.results[0];

            if (!user) {
                console.log(`Machine user ${username} not found, skipping deletion`);
                return;
            }

            // Only delete an actual ETL machine user. We identify one by its
            // service-account type and the `etl-` username convention rather
            // than a `machineUser` attribute: the service_account create
            // endpoint silently drops custom attributes (and the CloudTAK token
            // cannot PATCH them back), so that attribute is never present. This
            // guard prevents ever deleting a human account that happens to share
            // a username with a connection.
            if (!isMachineUser(user)) {
                console.log(`User ${username} is not an ETL machine user, skipping deletion`);
                return;
            }

            // Delete the user
            const deleteUrl = new URL(`/api/v3/core/users/${user.pk}/`, this.authentikUrl);
            const deleteResponse = await fetch(deleteUrl, {
                method: 'DELETE',
                headers: {
                    Authorization: `Bearer ${creds.token}`,
                    Accept: 'application/json',
                },
            });

            if (!deleteResponse.ok) {
                console.error(`Failed to delete machine user ${username}:`, await deleteResponse.text());
                return;
            }

            console.log(`Successfully deleted Authentik service account: ${username}`);
        } catch (err) {
            console.error(`Error deleting machine user ${username}:`, err);
            // Don't throw - allow connection deletion to continue
        }
    }

    /**
     * Look up an Authentik user by `email` first, falling back to `username`.
     * OIDC callers pass the userinfo `email` claim, which Authentik does not
     * guarantee equals the account's `username` field - querying by `email`
     * first avoids silently failing (and skipping cert enrollment/attribute
     * sync) for accounts where the two differ.
     */
    private async findUserByEmailOrUsername(token: string, identifier: string): Promise<AuthentikUser | undefined> {
        const byEmailUrl = new URL('/api/v3/core/users/', this.authentikUrl);
        byEmailUrl.searchParams.append('email', identifier);
        const byEmailResponse = await fetch(byEmailUrl, {
            headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        });
        if (!byEmailResponse.ok) throw new Err(500, new Error(await byEmailResponse.text()), 'Authentik User Fetch Error');
        const byEmailData = await byEmailResponse.json() as AuthentikPage<AuthentikUser>;
        if (byEmailData.results && byEmailData.results.length > 0) return byEmailData.results[0];

        const byUsernameUrl = new URL('/api/v3/core/users/', this.authentikUrl);
        byUsernameUrl.searchParams.append('username', identifier);
        const byUsernameResponse = await fetch(byUsernameUrl, {
            headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        });
        if (!byUsernameResponse.ok) throw new Err(500, new Error(await byUsernameResponse.text()), 'Authentik User Fetch Error');
        const byUsernameData = await byUsernameResponse.json() as AuthentikPage<AuthentikUser>;
        return byUsernameData.results?.[0];
    }

    async login(username: string): Promise<{
        id: number;
        name: string;
        phone: string | null;
        system_admin: boolean;
        agency_admin: Array<number>;
        tak_callsign?: string;
        tak_group?: string;
        tak_role?: string;
    }> {
        const creds = await this.auth();

        // `username` here is the OIDC email claim, which is not guaranteed to
        // equal the Authentik user's `username` field (Authentik allows those
        // to differ) - look up by `email` instead, falling back to `username`
        // for compatibility with any pre-existing password-auth callers.
        const user = await this.findUserByEmailOrUsername(creds.token, username);

        if (!user) throw new Err(404, null, 'User not found');

        const groupUuids = user.groups || [];
        const groups: string[] = [];

        for (const groupUuid of groupUuids) {
            try {
                const groupUrl = new URL(`/api/v3/core/groups/${groupUuid}/`, this.authentikUrl);
                const groupResponse = await fetch(groupUrl, {
                    headers: {
                        Authorization: `Bearer ${creds.token}`,
                        Accept: 'application/json',
                    },
                });
                if (groupResponse.ok) {
                    const groupData = await groupResponse.json() as AuthentikGroup;
                    if (groupData.name) groups.push(groupData.name);
                }
            } catch (err) {
                console.error(`Failed to fetch group ${groupUuid}:`, err);
            }
        }

        const systemAdminGroup = process.env.OIDC_SYSTEM_ADMIN_GROUP || 'CloudTAKSystemAdmin';
        const agencyAdminPrefix = process.env.OIDC_AGENCY_ADMIN_GROUP_PREFIX || 'CloudTAKAgency';

        const isSystemAdmin = groups.includes(systemAdminGroup);

        const agencyAdminIdSet = new Set<number>();
        for (const group of groups) {
            if (group.startsWith(agencyAdminPrefix)) {
                const agencyIdStr = group.substring(agencyAdminPrefix.length);
                const agencyId = parseInt(agencyIdStr, 10);
                if (!isNaN(agencyId) && agencyId > 0) {
                    agencyAdminIdSet.add(agencyId);
                }
            }
        }
        const agencyAdminIds: number[] = [...agencyAdminIdSet];

        const attributes = user.attributes || {};

        return {
            id: user.pk,
            name: user.name || username,
            phone: null,
            system_admin: isSystemAdmin,
            agency_admin: agencyAdminIds,
            // Passed through verbatim, matching upstream, which does not decorate
            // the callsign at all.
            //
            // This used to append " (Web)" so a browser session was distinguishable
            // from the same person's ATAK/WinTAK device, since Authentik hands the
            // same callsign attribute to both and TAK Server disambiguates clients
            // only by the literal callsign string. That trade was reconsidered: the
            // suffix showed up everywhere the callsign is displayed, and it is not
            // how upstream or any other TAK client behaves.
            //
            // Note the certificate enrollment path below still uses a " (Web)"
            // suffixed `clientUid`. That is a different identifier - it keeps the
            // browser's TAK Server client certificate from colliding with the user's
            // device certificate - and is deliberately left alone.
            tak_callsign: attributes.takCallsign,
            tak_group: asTakGroup(attributes.takColor, username),
            tak_role: asTakRole(attributes.takRole, username),
        };
    }

    /**
     * Create a short-lived Authentik app-password token for a human user
     * identified by email/username, then use it to generate a TAK client
     * certificate via the TAK Server WebTAK credentials endpoint.
     *
     * The app-password is set to expire in 5 minutes — long enough to complete
     * the certificate enrollment handshake but not lingering in Authentik.
     *
     * The whole set-password / TAK-login / revoke-password sequence mutates a
     * single shared credential (the Authentik user's password), so it is wrapped
     * in a Postgres advisory lock keyed on the username. Without this, two
     * concurrent enrollment attempts for the same user (e.g. a double-fired
     * OIDC callback from the browser) can interleave: request A sets password
     * #1 and starts logging into TAK Server, request B sets password #2 before
     * A's login completes, and A's TAK Server login then fails with a
     * stale-credential error because the password it's using no longer matches
     * what's stored in Authentik. The lock is acquired via a real Postgres
     * transaction (not an in-process mutex) so it serializes correctly across
     * multiple ECS tasks behind the load balancer, not just within one process.
     */
    /**
     * Attempt to enroll a TAK client certificate using an Authentik-issued
     * bearer token instead of a temporary password, via the OAuth2
     * client_credentials + JWT-bearer client-assertion exchange (RFC 7523).
     *
     * The `userAccessToken` (the real user's own CloudTAK-session OIDC token,
     * NOT CloudTAK's client credentials) is passed as `client_assertion` so
     * Authentik ties the exchanged token to that user's identity rather than
     * to a generic client_credentials service account - see
     * https://docs.goauthentik.io/.../machine_to_machine/#externally-issued-jwts
     * "JWT authentication" section. Using plain client_credentials here would
     * silently issue every enrollment to the same synthetic service account,
     * which is wrong and was an earlier mistake in this implementation.
     *
     * This only works if:
     *   1. TAK Server's CoreConfig.xml <oauth><authServer> trusts the OAuth2
     *      provider CloudTAK authenticates against (Federated OIDC Providers)
     *   2. That connector accepts bearer tokens (clientAuth="false", and the
     *      request hits a port AccessTokenResolver checks - 8446/8447)
     *   3. The exchanged token's usernameClaim/groupsClaim resolve to a real,
     *      known TAK Server identity
     * None of that is verified here - this is a best-effort attempt, logged
     * clearly at every step, that throws on any failure so the caller can fall
     * back to the existing temporary-password flow. Nothing about the
     * fallback path changes if this fails or is never configured.
     */
    private async enrollUserCertificateViaM2M(
        identifier: string,
        clientId: string,
        userAccessToken: string,
        takServerUrl: string,
    ): Promise<{ cert: string; key: string; ca: string[] }> {
        console.log(`[M2M] Attempting bearer-token cert enrollment for ${identifier} via Authentik JWT-bearer exchange`);

        // `identifier` here is the OIDC identifier CloudTAK resolved the user by
        // (preferred_username or email claim), which is not guaranteed to equal
        // the Authentik user's `username` field. Resolve the real Authentik
        // username up front so the certificate subject matches exactly what the
        // temporary-password fallback path below would produce for the same
        // user - otherwise the CN/clientUid a person gets depends on which of
        // the two enrollment paths happened to succeed.
        const creds = await this.auth();
        const user = await this.findUserByEmailOrUsername(creds.token, identifier);
        if (!user) throw new Err(404, null, `User ${identifier} not found in Authentik`);
        const username = user.username;

        // Exchange the user's own CloudTAK-issued access token for a new token,
        // using the JWT-bearer client-assertion grant so Authentik ties the
        // result to this user's subject rather than a generic client identity.
        const tokenUrl = new URL('/application/o/token/', this.authentikUrl);
        const tokenResponse = await fetch(tokenUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'client_credentials',
                client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
                client_assertion: userAccessToken,
                client_id: clientId,
                scope: 'openid profile email groups',
            }),
        });

        const tokenBody = await tokenResponse.text();
        if (!tokenResponse.ok) {
            throw new Err(500, null, `[M2M] Authentik client_credentials exchange failed (${tokenResponse.status}): ${tokenBody}`);
        }

        let exchangedToken: string;
        try {
            exchangedToken = JSON.parse(tokenBody).access_token;
        } catch {
            throw new Err(500, null, `[M2M] Authentik token response was not valid JSON: ${tokenBody}`);
        }
        if (!exchangedToken) {
            throw new Err(500, null, `[M2M] Authentik token response had no access_token: ${tokenBody}`);
        }

        console.log(`[M2M] Got exchanged token for ${username}, requesting cert from TAK Server`);

        // Step 2: build the CSR ourselves - node-tak's Credentials.generate()
        // hardcodes Basic auth (APIAuthPassword) and can't be reused for a
        // bearer token, so the TLS config fetch + CSR + signClient/v2 POST is
        // replicated here manually.
        const configUrl = new URL('/Marti/api/tls/config', takServerUrl);
        const configResponse = await fetch(configUrl, {
            headers: { Authorization: `Bearer ${exchangedToken}` },
        });
        if (!configResponse.ok) {
            throw new Err(500, null, `[M2M] TAK Server /tls/config rejected bearer token (${configResponse.status}): ${await configResponse.text()}`);
        }
        const configXml = await configResponse.text();

        let parsedConfig: {
            'ns2:certificateConfig'?: {
                nameEntries?: { nameEntry?: Array<{ _attributes?: { name?: string; value?: string } }> };
            };
        };
        try {
            parsedConfig = xmljs.xml2js(configXml, { compact: true }) as typeof parsedConfig;
        } catch (err) {
            throw new Err(500, err instanceof Error ? err : null, `[M2M] Failed to parse /tls/config XML for ${username}: ${configXml.slice(0, 500)}`);
        }

        let organization: string | undefined;
        let organizationUnit: string | undefined;
        const nameEntries = parsedConfig['ns2:certificateConfig']?.nameEntries;
        if (nameEntries?.nameEntry) {
            for (const ne of nameEntries.nameEntry) {
                if (ne._attributes?.name === 'O') organization = ne._attributes.value;
                if (ne._attributes?.name === 'OU') organizationUnit = ne._attributes.value;
            }
        }

        const { csr, clientKey } = await pem.promisified.createCSR({
            organization,
            organizationUnit,
            commonName: username,
        });

        const signUrl = new URL('/Marti/api/tls/signClient/v2', takServerUrl);
        signUrl.searchParams.append('clientUid', `${username} (Web)`);
        signUrl.searchParams.append('version', '3');

        const signResponse = await fetch(signUrl, {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                Authorization: `Bearer ${exchangedToken}`,
            },
            body: csr,
        });

        const signBody = await signResponse.text();
        if (!signResponse.ok) {
            throw new Err(500, null, `[M2M] TAK Server signClient/v2 rejected bearer token (${signResponse.status}): ${signBody}`);
        }

        let signed: { signedCert: string; ca0?: string; ca1?: string };
        try {
            signed = JSON.parse(signBody);
        } catch {
            throw new Err(500, null, `[M2M] TAK Server signClient/v2 response was not valid JSON: ${signBody}`);
        }

        let cert = '-----BEGIN CERTIFICATE-----\n' + signed.signedCert;
        if (!signed.signedCert.endsWith('\n')) cert += '\n';
        cert += '-----END CERTIFICATE-----';

        const ca: string[] = [];
        if (signed.ca0) ca.push(signed.ca0);
        if (signed.ca1) ca.push(signed.ca1);

        console.log(`[M2M] Cert enrollment succeeded for ${username} via bearer token exchange`);

        return { cert, key: clientKey, ca };
    }

    async enrollUserCertificate(
        username: string,
        takServerUrl: string,
        userAccessToken?: string,
    ): Promise<{ cert: string; key: string; ca: string[] }> {
        // Try the OAuth2 M2M bearer-token exchange first, if the caller has the
        // user's own OIDC access token (only available right after the OIDC
        // callback, not on password-login cert renewal paths) and CloudTAK's
        // client ID is configured. This is a straight attempt with no feature
        // flag - if it's not configured or TAK Server/Authentik reject it for
        // any reason, the error is logged and the existing temporary-password
        // flow below runs exactly as before.
        if (userAccessToken && process.env.OIDC_CLIENT_ID) {
            try {
                return await this.enrollUserCertificateViaM2M(
                    username,
                    process.env.OIDC_CLIENT_ID,
                    userAccessToken,
                    takServerUrl,
                );
            } catch (err) {
                console.error(`[M2M] Bearer-token cert enrollment failed for ${username}, falling back to temporary-password flow:`, err);
            }
        }

        return this.config.pg.transaction(async (tx) => {
            // Fixed namespace (arbitrary, just needs to not collide with other
            // advisory lock usage) + a hash of the username as the two int4 lock
            // keys. hashtext() is deterministic per-value within a session/process,
            // which is all that's required here — occasional hash collisions
            // between different usernames would only cause unrelated enrollments
            // to briefly serialize, not any incorrect behavior.
            await tx.execute(sql`SELECT pg_advisory_xact_lock(918273645, hashtext(${username}))`);

            const creds = await this.auth();

            // `username` here is the OIDC email claim, which is not guaranteed
            // to equal the Authentik user's `username` field - look up by
            // `email` instead, falling back to `username` for compatibility
            // with any pre-existing password-auth callers.
            const user = await this.findUserByEmailOrUsername(creds.token, username);
            if (!user) throw new Err(404, null, `User ${username} not found in Authentik`);

            // Set a random temporary password on the user account (overwritten after enrollment)
            const tempPassword = crypto.randomBytes(32).toString('base64url');
            const passwordUrl = new URL(`/api/v3/core/users/${user.pk}/set_password/`, this.authentikUrl);
            const passwordResponse = await fetch(passwordUrl, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${creds.token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: tempPassword }),
            });
            if (!passwordResponse.ok) throw new Err(500, new Error(await passwordResponse.text()), 'Failed to set temporary password for cert enrollment');

            try {
                // Authenticate to the TAK Server using Authentik's actual
                // `username` field (may differ from the OIDC email claim
                // passed into this method).
                const takAuth = new APIAuthPassword(user.username, tempPassword);
                const takApi = await TAKAPI.init(new URL(takServerUrl), takAuth);
                const enrollment = await takApi.Credentials.generate();
                return { cert: enrollment.cert, key: enrollment.key, ca: enrollment.ca || [] };
            } finally {
                // Always revoke the temporary password by setting a new random one,
                // so the account cannot be used with password auth after enrollment.
                const revokePassword = crypto.randomBytes(32).toString('base64url');
                const revokeUrl = new URL(`/api/v3/core/users/${user.pk}/set_password/`, this.authentikUrl);
                await fetch(revokeUrl, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${creds.token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password: revokePassword }),
                }).catch(err => console.error('Failed to revoke temporary password after cert enrollment:', err));
            }
        });
    }

    async renewConnectionCertificate(
        machineUserId: number,
        takServerUrl: string,
    ): Promise<{ cert: string; key: string }> {
        const creds = await this.auth();
        const tempPassword = crypto.randomBytes(32).toString('base64url');

        const passwordUrl = new URL(`/api/v3/core/users/${machineUserId}/set_password/`, this.authentikUrl);
        const passwordResponse = await fetch(passwordUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${creds.token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ password: tempPassword }),
        });

        if (!passwordResponse.ok) throw new Err(500, new Error(await passwordResponse.text()), 'Failed to set password');

        const userUrl = new URL(`/api/v3/core/users/${machineUserId}/`, this.authentikUrl);
        const userResponse = await fetch(userUrl, {
            headers: {
                Authorization: `Bearer ${creds.token}`,
                Accept: 'application/json',
            },
        });

        if (!userResponse.ok) throw new Err(500, new Error(await userResponse.text()), 'Failed to fetch user');
        const userData = await userResponse.json() as AuthentikUser;

        // Use password auth instead of potentially revoked certificate
        const takAuth = new APIAuthPassword(userData.username, tempPassword);
        const takApi = await TAKAPI.init(new URL(takServerUrl), takAuth);
        const enrollment = await takApi.Credentials.generate();

        return { cert: enrollment.cert, key: enrollment.key };
    }
}

import crypto from 'node:crypto';
import type { Request, Response } from 'express';
import { Type, Static } from '@sinclair/typebox';
import { sql, eq, count } from 'drizzle-orm';
import type { InferSelectModel } from 'drizzle-orm';
import Err from '@openaddresses/batch-error';
import type Config from '../../../common/config.js';
import { Profile, ProfileSession } from '../../../common/schema.js';
import type { ConnectionAuth } from '../../../common/connection-config.js';
import UserControl from './user.js';

export const SCIM_USER_SCHEMA = 'urn:ietf:params:scim:schemas:core:2.0:User';
export const SCIM_LIST_SCHEMA = 'urn:ietf:params:scim:api:messages:2.0:ListResponse';
export const SCIM_PATCH_SCHEMA = 'urn:ietf:params:scim:api:messages:2.0:PatchOp';
export const SCIM_ERROR_SCHEMA = 'urn:ietf:params:scim:api:messages:2.0:Error';
export const SCIM_CONTENT_TYPE = 'application/scim+json';

export const ScimName = Type.Object({
    formatted: Type.Optional(Type.String()),
    givenName: Type.Optional(Type.String()),
    familyName: Type.Optional(Type.String()),
});

export const ScimEmail = Type.Object({
    value: Type.String(),
    type: Type.Optional(Type.String()),
    primary: Type.Optional(Type.Boolean()),
});

export const ScimUserBody = Type.Object({
    schemas: Type.Optional(Type.Array(Type.String())),
    userName: Type.String({ minLength: 1 }),
    externalId: Type.Optional(Type.String()),
    name: Type.Optional(ScimName),
    displayName: Type.Optional(Type.String()),
    emails: Type.Optional(Type.Array(ScimEmail)),
    active: Type.Optional(Type.Boolean()),
});

export const ScimPatchBody = Type.Object({
    schemas: Type.Optional(Type.Array(Type.String())),
    Operations: Type.Array(Type.Object({
        op: Type.String(),
        path: Type.Optional(Type.String()),
        value: Type.Optional(Type.Unknown()),
    }), { minItems: 1 }),
});

export const ScimUser = Type.Object({
    schemas: Type.Array(Type.String()),
    id: Type.String(),
    userName: Type.String(),
    name: Type.Object({
        formatted: Type.String(),
    }),
    displayName: Type.String(),
    emails: Type.Array(ScimEmail),
    active: Type.Boolean(),
    meta: Type.Object({
        resourceType: Type.Literal('User'),
        created: Type.String(),
        lastModified: Type.String(),
        location: Type.String(),
    }),
});

export const ScimUserList = Type.Object({
    schemas: Type.Array(Type.String()),
    totalResults: Type.Integer(),
    startIndex: Type.Integer(),
    itemsPerPage: Type.Integer(),
    Resources: Type.Array(ScimUser),
});

export const ScimError = Type.Object({
    schemas: Type.Array(Type.String()),
    status: Type.String(),
    scimType: Type.Optional(Type.String()),
    detail: Type.String(),
});

export type ScimUserInput = {
    name?: Static<typeof ScimName>;
    displayName?: string;
    active?: boolean;
};

const ScimTypeByStatus: Record<number, string> = {
    400: 'invalidValue',
    409: 'uniqueness',
};

/**
 * Respond with an RFC 7644 formatted error document
 */
function isPublicError(err: unknown): err is Err {
    return typeof err === 'object' && err !== null && (err as Error).name === 'PublicError';
}

export function scimRespond(err: unknown, res: Response): void {
    const status = isPublicError(err) ? Number(err.status) : 500;
    const detail = isPublicError(err) ? err.safe : 'Internal Server Error';

    if (status === 500) console.error(err);

    const scimType = err instanceof ScimErr ? err.scimType : ScimTypeByStatus[status];

    res.status(status).type(SCIM_CONTENT_TYPE).send({
        schemas: [SCIM_ERROR_SCHEMA],
        status: String(status),
        ...(scimType ? { scimType } : {}),
        detail,
    });
}

export class ScimErr extends Err {
    scimType?: string;

    constructor(status: number, safe: string, scimType?: string) {
        super(status, null, safe, status >= 500);
        this.scimType = scimType;
    }
}

function formatName(name?: Static<typeof ScimName>): string | undefined {
    if (!name) return undefined;
    if (name.formatted && name.formatted.trim()) return name.formatted.trim();
    const parts = [name.givenName, name.familyName].filter(part => part && part.trim());
    return parts.length ? parts.join(' ') : undefined;
}

export default class ScimControl {
    config: Config;
    userControl: UserControl;

    constructor(config: Config) {
        this.config = config;
        this.userControl = new UserControl(config);
    }

    /**
     * Ensure SCIM is enabled and the request carries the configured bearer token
     */
    async auth(req: Request<any, any, any, any>): Promise<void> {
        const settings = await this.config.models.Setting.typedMany({
            'scim::enabled': false,
            'scim::token': '',
        });

        if (!settings['scim::enabled']) {
            throw new ScimErr(403, 'SCIM provisioning is not enabled');
        }

        if (!settings['scim::token']) {
            throw new ScimErr(403, 'SCIM token has not been configured');
        }

        const [scheme, presented] = String(req.header('authorization') || '').split(' ');

        if (!scheme || scheme.toLowerCase() !== 'bearer' || !presented) {
            throw new ScimErr(401, 'Bearer authorization is required');
        }

        const expected = crypto.createHash('sha256').update(settings['scim::token']).digest();
        const actual = crypto.createHash('sha256').update(presented).digest();

        if (!crypto.timingSafeEqual(expected, actual)) {
            throw new ScimErr(401, 'Invalid SCIM token');
        }
    }

    location(username: string): string {
        return `${this.config.API_URL}/api/scim/v2/Users/${encodeURIComponent(username)}`;
    }

    async serialize(profile: InferSelectModel<typeof Profile>): Promise<Static<typeof ScimUser>> {
        const settings = await this.config.models.ProfileConfig.from(profile.username);

        return {
            schemas: [SCIM_USER_SCHEMA],
            id: profile.username,
            userName: profile.username,
            name: {
                formatted: profile.name || '',
            },
            displayName: String(settings['tak::callsign'] ?? ''),
            emails: [{
                value: profile.username,
                type: 'work',
                primary: true,
            }],
            active: !profile.disabled,
            meta: {
                resourceType: 'User',
                created: profile.created,
                lastModified: profile.updated,
                location: this.location(profile.username),
            },
        };
    }

    /**
     * Parse the subset of the SCIM filter grammar that Identity Providers use for
     * lookups - a single equality on the username attribute
     */
    static parseFilter(filter?: string): string | undefined {
        if (!filter || !filter.trim()) return undefined;

        const match = filter.trim().match(/^(userName|emails(?:\.value)?|externalId|id)\s+eq\s+"((?:[^"\\]|\\.)*)"$/i);

        if (!match) {
            throw new ScimErr(400, 'Only "userName eq \\"value\\"" filters are supported', 'invalidFilter');
        }

        return match[2].replace(/\\(.)/g, '$1').toLowerCase();
    }

    async from(id: string): Promise<InferSelectModel<typeof Profile>> {
        try {
            return await this.config.models.Profile.from(id.toLowerCase());
        } catch (err) {
            if (isPublicError(err) && Number(err.status) === 404) {
                throw new ScimErr(404, `User ${id} not found`);
            }

            throw err;
        }
    }

    async list(opts: {
        filter?: string;
        startIndex: number;
        count: number;
    }): Promise<Static<typeof ScimUserList>> {
        const username = ScimControl.parseFilter(opts.filter);
        const where = username ? eq(Profile.username, username) : undefined;

        const pool = this.config.models.Profile.pool;

        const [{ total }] = await pool
            .select({ total: count() })
            .from(Profile)
            .where(where);

        const profiles = await pool
            .select()
            .from(Profile)
            .where(where)
            .orderBy(Profile.username)
            .limit(opts.count)
            .offset(opts.startIndex - 1);

        return {
            schemas: [SCIM_LIST_SCHEMA],
            totalResults: Number(total),
            startIndex: opts.startIndex,
            itemsPerPage: profiles.length,
            Resources: await Promise.all(profiles.map(profile => this.serialize(profile))),
        };
    }

    async create(body: Static<typeof ScimUserBody>): Promise<InferSelectModel<typeof Profile>> {
        const username = body.userName.trim().toLowerCase();

        let existing: InferSelectModel<typeof Profile> | undefined;
        try {
            existing = await this.config.models.Profile.from(username);
        } catch (err) {
            if (!isPublicError(err) || Number(err.status) !== 404) throw err;
        }

        if (existing) {
            throw new ScimErr(409, `User ${username} already exists`, 'uniqueness');
        }

        // Certificates are issued from the TAK Server on the user's first login
        const profile = await this.userControl.generate({
            username,
            name: formatName(body.name) ?? 'Unknown',
            auth: {} as Static<typeof ConnectionAuth>,
            disabled: body.active === false,
        });

        if (body.displayName) {
            await this.config.models.ProfileConfig.commit(username, {
                'tak::callsign': body.displayName,
            });
        }

        return profile;
    }

    async update(
        profile: InferSelectModel<typeof Profile>,
        input: ScimUserInput,
    ): Promise<InferSelectModel<typeof Profile>> {
        const patch: Partial<InferSelectModel<typeof Profile>> = {};

        const name = formatName(input.name);
        if (name !== undefined) patch.name = name;

        if (input.active !== undefined) patch.disabled = !input.active;

        if (Object.keys(patch).length) {
            profile = await this.config.models.Profile.commit(profile.username, {
                ...patch,
                updated: new Date().toISOString(),
            });
        }

        if (input.displayName !== undefined) {
            await this.config.models.ProfileConfig.commit(profile.username, {
                'tak::callsign': input.displayName,
            });
        }

        if (input.active === false) {
            await this.revokeSessions(profile.username);
        }

        return profile;
    }

    /**
     * Apply RFC 7644 PatchOp operations - unsupported paths are ignored so that
     * Identity Providers sending their full attribute mapping do not fail
     */
    static patchInput(operations: Static<typeof ScimPatchBody>['Operations'], id: string): ScimUserInput {
        const input: ScimUserInput = {};

        const assign = (path: string, value: unknown) => {
            const key = path.toLowerCase();

            if (key === 'active') {
                input.active = typeof value === 'string' ? value.toLowerCase() === 'true' : Boolean(value);
            } else if (key === 'displayname') {
                input.displayName = value === null || value === undefined ? '' : String(value);
            } else if (key === 'name.formatted' || key === 'name.givenname' || key === 'name.familyname') {
                input.name = input.name || {};
                const field = key.split('.')[1] === 'formatted' ? 'formatted' : key.split('.')[1] === 'givenname' ? 'givenName' : 'familyName';
                input.name[field] = value === null || value === undefined ? '' : String(value);
            } else if (key === 'name' && value && typeof value === 'object') {
                input.name = { ...(input.name || {}), ...(value as Static<typeof ScimName>) };
            } else if (key === 'username') {
                if (String(value).trim().toLowerCase() !== id.toLowerCase()) {
                    throw new ScimErr(400, 'userName cannot be changed', 'mutability');
                }
            }
        };

        for (const operation of operations) {
            const op = operation.op.toLowerCase();

            if (op !== 'replace' && op !== 'add') {
                if (op === 'remove') continue;
                throw new ScimErr(400, `Unsupported PatchOp operation: ${operation.op}`, 'invalidValue');
            }

            if (operation.path) {
                assign(operation.path, operation.value);
            } else if (operation.value && typeof operation.value === 'object') {
                for (const [path, value] of Object.entries(operation.value as Record<string, unknown>)) {
                    assign(path, value);
                }
            } else {
                throw new ScimErr(400, 'PatchOp operation requires a path or an object value', 'invalidValue');
            }
        }

        return input;
    }

    /**
     * Deprovision a user - the Profile is retained (it is referenced by the
     * user's data) but is disabled and all login sessions are removed
     */
    async deprovision(profile: InferSelectModel<typeof Profile>): Promise<void> {
        await this.update(profile, { active: false });
    }

    async revokeSessions(username: string): Promise<void> {
        await this.config.models.ProfileSession.delete(sql`${ProfileSession.username} = ${username}`);
    }
}

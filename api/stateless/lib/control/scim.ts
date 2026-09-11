import crypto from 'node:crypto';
import type { Request, Response } from 'express';
import { Type, Static } from '@sinclair/typebox';
import type { TSchema } from '@sinclair/typebox';
import { sql, eq, count } from 'drizzle-orm';
import type { InferSelectModel } from 'drizzle-orm';
import Err from '@openaddresses/batch-error';
import type Config from '../../../common/config.js';
import { Profile, ProfileSession } from '../../../common/schema.js';
import UserControl from './user.js';

export const SCIM_USER_SCHEMA = 'urn:ietf:params:scim:schemas:core:2.0:User';
export const SCIM_GROUP_SCHEMA = 'urn:ietf:params:scim:schemas:core:2.0:Group';
export const SCIM_LIST_SCHEMA = 'urn:ietf:params:scim:api:messages:2.0:ListResponse';
export const SCIM_PATCH_SCHEMA = 'urn:ietf:params:scim:api:messages:2.0:PatchOp';
export const SCIM_ERROR_SCHEMA = 'urn:ietf:params:scim:api:messages:2.0:Error';
export const SCIM_CONTENT_TYPE = 'application/scim+json';

export function scimBody<T extends TSchema>(schema: T): Record<string, T> {
    return {
        'application/json': schema,
        [SCIM_CONTENT_TYPE]: schema,
    };
}

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

export const ScimMember = Type.Object({
    value: Type.String({ minLength: 1 }),
    display: Type.Optional(Type.String()),
});

export const ScimGroupBody = Type.Object({
    schemas: Type.Optional(Type.Array(Type.String())),
    displayName: Type.String({ minLength: 1 }),
    externalId: Type.Optional(Type.String()),
    members: Type.Optional(Type.Array(ScimMember)),
});

export const ScimGroupResource = Type.Object({
    schemas: Type.Array(Type.String()),
    id: Type.String(),
    displayName: Type.String(),
    externalId: Type.Optional(Type.String()),
    members: Type.Array(ScimMember),
    meta: Type.Object({
        resourceType: Type.Literal('Group'),
        created: Type.String(),
        lastModified: Type.String(),
        location: Type.String(),
    }),
});

export const ScimGroupList = Type.Object({
    schemas: Type.Array(Type.String()),
    totalResults: Type.Integer(),
    startIndex: Type.Integer(),
    itemsPerPage: Type.Integer(),
    Resources: Type.Array(ScimGroupResource),
});

export type ScimGroupInput = {
    displayName?: string;
    externalId?: string | null;
    members?: string[];
    addMembers?: string[];
    removeMembers?: string[];
};

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

function memberValues(members: unknown): string[] {
    const list = Array.isArray(members) ? members : [members];

    const values = list.map((member) => {
        if (typeof member === 'string') return member;
        if (member && typeof member === 'object' && 'value' in member) return String((member as { value: unknown }).value);
        return '';
    }).map(value => value.trim().toLowerCase()).filter(Boolean);

    return Array.from(new Set(values));
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

        // A null auth marks a provisioned user - the certificate is issued on their first login
        const profile = await this.userControl.generate({
            username,
            name: formatName(body.name) ?? 'Unknown',
            auth: null,
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

    groupLocation(id: string): string {
        return `${this.config.API_URL}/api/scim/v2/Groups/${id}`;
    }

    /**
     * Groups are accepted but not stored - the id is a reversible encoding of the
     * displayName so an Identity Provider can address the Group on later syncs
     */
    static groupId(displayName: string): string {
        return Buffer.from(displayName, 'utf8').toString('base64url');
    }

    static groupName(id: string): string {
        const displayName = Buffer.from(id, 'base64url').toString('utf8');

        const control = Array.from(displayName).some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127);

        if (!displayName || control || ScimControl.groupId(displayName) !== id) {
            throw new ScimErr(404, `Group ${id} not found`);
        }

        return displayName;
    }

    serializeGroup(group: {
        displayName: string;
        externalId?: string | null;
        members?: string[];
    }): Static<typeof ScimGroupResource> {
        const id = ScimControl.groupId(group.displayName);
        const now = new Date().toISOString();

        return {
            schemas: [SCIM_GROUP_SCHEMA],
            id,
            displayName: group.displayName,
            ...(group.externalId ? { externalId: group.externalId } : {}),
            members: (group.members || []).map(value => ({ value, display: value })),
            meta: {
                resourceType: 'Group',
                created: now,
                lastModified: now,
                location: this.groupLocation(id),
            },
        };
    }

    static parseGroupFilter(filter?: string): { attribute: 'displayName' | 'externalId' | 'id'; value: string } | undefined {
        if (!filter || !filter.trim()) return undefined;

        const match = filter.trim().match(/^(displayName|externalId|id)\s+eq\s+"((?:[^"\\]|\\.)*)"$/i);

        if (!match) {
            throw new ScimErr(400, 'Only "displayName eq \\"value\\"" and "externalId eq \\"value\\"" filters are supported', 'invalidFilter');
        }

        const attribute = match[1].toLowerCase() === 'displayname' ? 'displayName' : match[1].toLowerCase() === 'externalid' ? 'externalId' : 'id';

        return { attribute, value: match[2].replace(/\\(.)/g, '$1') };
    }

    groupList(opts: {
        filter?: string;
        startIndex: number;
        count: number;
    }): Static<typeof ScimGroupList> {
        const filter = ScimControl.parseGroupFilter(opts.filter);

        const groups: Static<typeof ScimGroupResource>[] = [];

        if (filter && filter.attribute === 'displayName' && filter.value.trim()) {
            groups.push(this.serializeGroup({ displayName: filter.value.trim() }));
        } else if (filter && filter.attribute === 'id') {
            try {
                groups.push(this.serializeGroup({ displayName: ScimControl.groupName(filter.value) }));
            } catch (err) {
                if (!isPublicError(err) || Number(err.status) !== 404) throw err;
            }
        }

        const page = opts.startIndex === 1 ? groups.slice(0, opts.count) : [];

        return {
            schemas: [SCIM_LIST_SCHEMA],
            totalResults: groups.length,
            startIndex: opts.startIndex,
            itemsPerPage: page.length,
            Resources: page,
        };
    }

    groupCreate(body: Static<typeof ScimGroupBody>): Static<typeof ScimGroupResource> {
        const displayName = body.displayName.trim();
        if (!displayName) throw new ScimErr(400, 'displayName cannot be empty', 'invalidValue');

        return this.serializeGroup({
            displayName,
            externalId: body.externalId,
            members: memberValues(body.members || []),
        });
    }

    groupUpdate(id: string, input: ScimGroupInput): Static<typeof ScimGroupResource> {
        let displayName = ScimControl.groupName(id);

        if (input.displayName !== undefined) {
            displayName = input.displayName.trim();
            if (!displayName) throw new ScimErr(400, 'displayName cannot be empty', 'invalidValue');
        }

        let members = input.members ? [...input.members] : [];

        if (input.addMembers) {
            members = Array.from(new Set([...members, ...input.addMembers]));
        }

        if (input.removeMembers) {
            const remove = new Set(input.removeMembers);
            members = members.filter(member => !remove.has(member));
        }

        return this.serializeGroup({
            displayName,
            externalId: input.externalId,
            members,
        });
    }

    /**
     * Apply RFC 7644 PatchOp operations to a Group - displayName, externalId and
     * members are supported, including the `members[value eq "id"]` remove form
     */
    static groupPatchInput(operations: Static<typeof ScimPatchBody>['Operations']): ScimGroupInput {
        const input: ScimGroupInput = {};

        const assign = (op: string, path: string, value: unknown) => {
            const key = path.trim();
            const lower = key.toLowerCase();

            if (lower === 'displayname') {
                if (op === 'remove') throw new ScimErr(400, 'displayName cannot be removed', 'mutability');
                input.displayName = String(value ?? '');
            } else if (lower === 'externalid') {
                input.externalId = op === 'remove' || value === null || value === undefined ? null : String(value);
            } else if (lower === 'members') {
                if (op === 'replace') {
                    input.members = memberValues(value ?? []);
                } else if (op === 'add') {
                    input.addMembers = [...(input.addMembers || []), ...memberValues(value ?? [])];
                } else if (value === undefined || value === null) {
                    input.members = [];
                } else {
                    input.removeMembers = [...(input.removeMembers || []), ...memberValues(value)];
                }
            } else if (lower.startsWith('members[')) {
                const match = key.match(/^members\[\s*value\s+eq\s+"((?:[^"\\]|\\.)*)"\s*\]$/i);

                if (!match) throw new ScimErr(400, `Unsupported members filter path: ${path}`, 'invalidPath');

                const member = match[1].replace(/\\(.)/g, '$1');

                if (op === 'remove') {
                    input.removeMembers = [...(input.removeMembers || []), ...memberValues(member)];
                } else {
                    input.addMembers = [...(input.addMembers || []), ...memberValues(member)];
                }
            }
        };

        for (const operation of operations) {
            const op = operation.op.toLowerCase();

            if (op !== 'replace' && op !== 'add' && op !== 'remove') {
                throw new ScimErr(400, `Unsupported PatchOp operation: ${operation.op}`, 'invalidValue');
            }

            if (operation.path) {
                assign(op, operation.path, operation.value);
            } else if (operation.value && typeof operation.value === 'object') {
                for (const [path, value] of Object.entries(operation.value as Record<string, unknown>)) {
                    assign(op, path, value);
                }
            } else {
                throw new ScimErr(400, 'PatchOp operation requires a path or an object value', 'invalidValue');
            }
        }

        return input;
    }

    async revokeSessions(username: string): Promise<void> {
        await this.config.models.ProfileSession.delete(sql`${ProfileSession.username} = ${username}`);
    }
}

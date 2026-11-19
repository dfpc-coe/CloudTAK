import type { Request } from 'express';
import Err from '@openaddresses/batch-error';
import jwt from 'jsonwebtoken';
import Config from './config.js';
import { InferSelectModel } from 'drizzle-orm';
import type { Profile, Connection, ConnectionToken, Layer } from './schema.js';
import { authenticatedProfile, type AuthenticatedProfile } from './control/profile.js';

export type AnyRequest = Pick<Request, 'headers' | 'header' | 'socket'> & { query?: unknown };

export enum ResourceCreationScope {
    SERVER = 'server',
    USER = 'user',
}

export enum AuthUserAccess {
    ADMIN = 'admin',
    AGENCY = 'agency',
    USER = 'user',
}

export function accessFor(profile: { system_admin: boolean; agency_admin: Array<number> | null }): AuthUserAccess {
    if (profile.system_admin) return AuthUserAccess.ADMIN;
    if (profile.agency_admin && profile.agency_admin.length) return AuthUserAccess.AGENCY;
    return AuthUserAccess.USER;
}

function castUserAccessEnum(str: string): AuthUserAccess | undefined {
    const value = AuthUserAccess[str.toUpperCase() as keyof typeof AuthUserAccess];
    return value;
}

export type AuthResourceAccepted = {
    access: AuthResourceAccess;
    id?: string | number | undefined;
};

export enum AuthResourceAccess {
    DATA = 'data',
    LAYER = 'layer',
    IMPORT = 'import',
    LEASE = 'lease',
    BASEMAP = 'basemap',
    CONNECTION = 'connection',

    // Only used for media-infra <=> CloudTAK requests
    MEDIA = 'media',

    // Becomes AuthUser
    PROFILE = 'profile',
}

function castResourceAccessEnum(str: string): AuthResourceAccess | undefined {
    const value = AuthResourceAccess[str.toUpperCase() as keyof typeof AuthResourceAccess];
    return value;
}

export class AuthResource {
    id: number | string | undefined;
    access: AuthResourceAccess;
    token: string;
    internal: boolean;

    // Per token lookups, loaded at most once
    layer?: Promise<InferSelectModel<typeof Layer>>;
    connectionToken?: Promise<InferSelectModel<typeof ConnectionToken> | undefined>;

    constructor(
        token: string,
        access: AuthResourceAccess,
        id: number | string | undefined,
        internal: boolean,
    ) {
        this.token = token;
        this.internal = internal;
        this.access = access;
        this.id = id;
    }
}

export class AuthUser {
    access: AuthUserAccess;
    email: string;
    token: string;
    session?: string;

    // Username of admin doing the impersonating - if this value is populated the calling user is guarenteed to be an admin
    impersonate?: string;

    constructor(access: AuthUserAccess, email: string, token: string, session?: string) {
        this.access = access;
        this.email = email;
        this.token = token;
        this.session = session;
    }

    is_admin(): boolean {
        return this.access === AuthUserAccess.ADMIN;
    }

    is_user(): boolean {
        return !!(this.email && this.email.length);
    }
}

type TokenSource = 'header' | 'query';

/** The principal a security scheme accepts - a user, one kind of resource token, or any resource token */
type SchemeKind = 'user' | 'resource' | AuthResourceAccess;

type RequestAuth = {
    header?: Promise<AuthResource | AuthUser>;
    query?: Promise<AuthResource | AuthUser>;
    granted?: AuthResource | AuthUser;
};

const requests = new WeakMap<object, RequestAuth>();

const SCHEME_KINDS: Array<{ kind: SchemeKind; name: string; description: string }> = [
    { kind: 'user', name: 'bearer', description: 'CloudTAK User JWT - the `admin` scope requires a System Administrator' },
    { kind: AuthResourceAccess.LAYER, name: 'layer', description: 'Layer ETL token (`etl.<jwt>`) - the listed scopes must be present in the Layer\'s `permissions`' },
    { kind: AuthResourceAccess.CONNECTION, name: 'connection', description: 'Connection token (`etl.<jwt>`) - the listed scopes must be present in the token\'s `permissions`' },
    { kind: AuthResourceAccess.DATA, name: 'data', description: 'Data Sync token (`etl.<jwt>`)' },
    { kind: AuthResourceAccess.IMPORT, name: 'import', description: 'Import token (`etl.<jwt>`)' },
    { kind: AuthResourceAccess.LEASE, name: 'lease', description: 'Video Lease token (`etl.<jwt>`)' },
    { kind: AuthResourceAccess.BASEMAP, name: 'basemap', description: 'Basemap sharing token (`etl.<jwt>`)' },
    { kind: 'resource', name: 'resource', description: 'Any resource token (`etl.<jwt>`)' },
];

function schemeName(kind: SchemeKind, source: TokenSource): string {
    const scheme = SCHEME_KINDS.find(s => s.kind === kind);
    if (!scheme) throw new Error(`No security scheme for ${kind}`);

    return source === 'query' ? `${scheme.name}QueryAuth` : `${scheme.name}Auth`;
}

/**
 * OpenAPI Security Schemes - every kind of token as a bearer header, and as
 * a `token` query parameter for the routes that accept one
 */
export const SECURITY_SCHEMES: Record<string, object> = {
    anonymousAuth: {
        type: 'http',
        scheme: 'bearer',
        description: 'No credentials required - listed after the schemes a route can also authenticate with',
    },
    scimAuth: {
        type: 'http',
        scheme: 'bearer',
        description: 'SCIM token configured by a System Administrator (`scim::token`)',
    },
};

for (const scheme of SCHEME_KINDS) {
    SECURITY_SCHEMES[schemeName(scheme.kind, 'header')] = {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: scheme.description,
    };

    SECURITY_SCHEMES[schemeName(scheme.kind, 'query')] = {
        type: 'apiKey',
        in: 'query',
        name: 'token',
        description: `${scheme.description} - as the \`token\` query parameter`,
    };
}

export type SecurityOptions = {
    /** Accept users - defaults to true */
    user?: boolean;
    /** Users must be a System Administrator */
    admin?: boolean;
    /** Kinds of resource token accepted */
    resources?: Array<AuthResourceAccess>;
    /** Accept every kind of resource token */
    anyResources?: boolean;
    /** `<permission>:<level>` scope(s) a Layer or Connection token must hold - every scope given is required */
    scope?: string | Array<string>;
    /** Also accept the token as the `token` query parameter (usually only for downloads) */
    token?: boolean;
    /** Also accept unauthenticated requests - the route handler decides when a caller is required */
    optional?: boolean;
};

/**
 * Handlers that enforce the `security` a route declares, one per Security
 * Scheme. The route handler then reads the authorized caller back with
 * `Auth.is_auth`, `Auth.as_user` & co
 */
export function securityHandlers(config: Config): Record<string, (req: Request, scopes: Array<string>) => Promise<AuthResource | AuthUser | true>> {
    const handlers: Record<string, (req: Request, scopes: Array<string>) => Promise<AuthResource | AuthUser | true>> = {
        // SCIM errors use the SCIM envelope, so SCIM routes authenticate themselves
        scimAuth: async () => true,
        anonymousAuth: async () => true,
    };

    for (const scheme of SCHEME_KINDS) {
        for (const source of ['header', 'query'] as const) {
            handlers[schemeName(scheme.kind, source)] = async (req, scopes) => {
                return await Auth.authorize(config, req, scheme.kind, source, scopes);
            };
        }
    }

    return handlers;
}

/**
 * @class
 */
export default class Auth {
    /**
     * OpenAPI Security Requirements for a route - enforced before the route
     * handler runs. A route without any accepts users only
     *
     * Given scope(s) alone, users and Layer tokens holding the scope(s) are
     * accepted, plus Connection tokens when `opts.connection` is set
     */
    static security(scope: string | Array<string>, opts?: { connection?: boolean }): Array<Record<string, Array<string>>>;
    static security(opts: SecurityOptions): Array<Record<string, Array<string>>>;
    static security(
        input: string | Array<string> | SecurityOptions,
        legacy: { connection?: boolean } = {},
    ): Array<Record<string, Array<string>>> {
        const opts: SecurityOptions = typeof input === 'string' || Array.isArray(input)
            ? {
                    scope: input,
                    resources: legacy.connection
                        ? [AuthResourceAccess.LAYER, AuthResourceAccess.CONNECTION]
                        : [AuthResourceAccess.LAYER],
                }
            : input;

        const scopes = opts.scope === undefined ? [] : (Array.isArray(opts.scope) ? opts.scope : [opts.scope]);
        const sources: Array<TokenSource> = opts.token ? ['header', 'query'] : ['header'];
        const kinds: Array<SchemeKind> = opts.anyResources ? ['resource'] : (opts.resources || []);

        const security: Array<Record<string, Array<string>>> = [];

        // Resource tokens first so a token missing a scope is told so rather than that it is not a user
        for (const kind of kinds) {
            const scoped = kind === 'resource' || kind === AuthResourceAccess.LAYER || kind === AuthResourceAccess.CONNECTION;

            for (const source of sources) {
                security.push({ [schemeName(kind, source)]: scoped ? scopes : [] });
            }
        }

        if (opts.user !== false) {
            for (const source of sources) {
                security.push({ [schemeName('user', source)]: opts.admin ? ['admin'] : [] });
            }
        }

        if (opts.optional) security.push({ anonymousAuth: [] });

        return security;
    }

    /**
     * Decide if a request satisfies one Security Scheme - called by the
     * handlers of `securityHandlers` before the route handler runs
     */
    static async authorize(
        config: Config,
        req: AnyRequest,
        kind: SchemeKind,
        source: TokenSource,
        scopes: Array<string>,
    ): Promise<AuthResource | AuthUser> {
        let state = requests.get(req);
        if (!state) {
            state = {};
            requests.set(req, state);
        }

        let parsed = state[source];
        if (!parsed) {
            parsed = auth_request(config, req, source);
            state[source] = parsed;
        }

        const auth = await parsed;

        if (kind === 'user') {
            if (auth instanceof AuthResource) throw new Err(403, null, 'Resource token cannot access this resource');

            if (scopes.includes('admin') && auth.access !== AuthUserAccess.ADMIN) {
                throw new Err(401, null, 'User must be a System Administrator to access this resource');
            }
        } else {
            if (auth instanceof AuthUser) throw new Err(401, null, 'Only a resource token can access this resource');

            await this.#connection_token(config, auth);

            // A 401 so the scheme for the token's own kind, or failing that the user scheme, decides the response
            if (kind !== 'resource' && auth.access !== kind) {
                throw new Err(401, null, 'Resource token cannot access this resource');
            }

            await this.ensure_scope(config, auth, scopes);
        }

        state.granted = auth;

        return auth;
    }

    static #granted(req: AnyRequest): AuthResource | AuthUser {
        const auth = requests.get(req)?.granted;
        if (!auth) throw new Err(401, null, 'No Auth Present');
        return auth;
    }

    /** The Connection token a non-internal resource token was issued as - rejected once it has been deleted */
    static async #connection_token(config: Config, auth: AuthResource): Promise<InferSelectModel<typeof ConnectionToken> | undefined> {
        if (auth.internal) return undefined;

        if (!auth.connectionToken) {
            auth.connectionToken = config.models.ConnectionToken.from(auth.token).catch((err) => {
                if (err instanceof Error) {
                    throw new Err(403, err.name === 'PublicError' ? err : new Error(String(err)), 'Token does not exist');
                } else {
                    throw new Err(500, new Error(String(err)), 'Unknown Token Error');
                }
            });
        }

        return await auth.connectionToken;
    }

    /** The Layer a Layer token belongs to */
    static async layer(config: Config, auth: AuthResource): Promise<InferSelectModel<typeof Layer>> {
        if (auth.access !== AuthResourceAccess.LAYER) throw new Err(401, null, 'Only a Layer Resource Token can access this resource');
        if (auth.id === undefined) throw new Err(401, null, 'Layer Resource Token must contain a Layer ID');

        if (!auth.layer) auth.layer = config.models.Layer.from(auth.id);

        return await auth.layer;
    }

    /**
     * The caller the route's `security` authorized - can be either a Resource or User auth
     *
     * @param config    - Server Config
     * @param req       - Express Request
     * @param opts.resources    - Resource tokens must be one of these, used to bind a token to an ID from the request
     */
    static async is_auth(config: Config, req: AnyRequest, opts: {
        resources?: Array<AuthResourceAccepted>;
    } = {}): Promise<AuthResource | AuthUser> {
        const auth = this.#granted(req);

        if (auth instanceof AuthResource && opts.resources && !opts.resources.some((r) => {
            if (r.id) {
                return r.access === auth.access && r.id === auth.id;
            } else {
                return r.access === auth.access;
            }
        })) {
            throw new Err(403, null, 'Resource token cannot access this resource');
        }

        return auth;
    }

    /**
     * Ensure a Layer or Connection token holds every given `<permission>:<level>`
     * scope - for checks that depend on state loaded in the route handler, such
     * as the kind of the Entity a route resolves to. Users always pass
     */
    static async ensure_scope(
        config: Config,
        auth: AuthResource | AuthUser,
        scope: string | Array<string>,
    ): Promise<void> {
        if (!(auth instanceof AuthResource)) return;

        const scopes = Array.isArray(scope) ? scope : [scope];
        if (!scopes.length) return;

        if (auth.access === AuthResourceAccess.LAYER) {
            const layer = await this.layer(config, auth);

            for (const s of scopes) {
                if (!hasScope(layer.permissions, s)) {
                    throw new Err(403, null, `Layer token does not have the ${s} permission`);
                }
            }
        } else if (auth.access === AuthResourceAccess.CONNECTION && !auth.internal) {
            const token = await this.#connection_token(config, auth);

            for (const s of scopes) {
                if (!token || !hasScope(token.permissions, s)) {
                    throw new Err(403, null, `Connection token does not have the ${s} permission`);
                }
            }
        }
    }

    static async is_connection(config: Config, req: AnyRequest, opts: {
        resources?: Array<AuthResourceAccepted>;
    }, connectionid: number): Promise<{
        auth: AuthResource | AuthUser;
        connection: InferSelectModel<typeof Connection>;
        layer?: InferSelectModel<typeof Layer>;
        profile?: InferSelectModel<typeof Profile>;
    }> {
        const auth = await this.is_auth(config, req, opts);

        return await this.is_connection_auth(config, auth, connectionid);
    }

    /**
     * Authorize an already parsed Auth object against a given Connection
     *
     * Only Layer tokens are scoped here - callers must gate which other
     * resource token types are allowed before calling this
     */
    static async is_connection_auth(
        config: Config,
        auth: AuthResource | AuthUser,
        connectionid: number,
    ): Promise<{
        auth: AuthResource | AuthUser;
        connection: InferSelectModel<typeof Connection>;
        layer?: InferSelectModel<typeof Layer>;
        profile?: InferSelectModel<typeof Profile>;
    }> {
        const connection = await config.models.Connection.from(connectionid);

        if (auth instanceof AuthUser) {
            const profile = await authenticatedProfile(config, auth.email);

            if (profile.system_admin === true) {
                return { connection, profile, auth };
            } else {
                if (!connection.agency) throw new Err(401, null, 'Only a System Admin can access this connection');
                if (!profile.agency_admin) throw new Err(401, null, 'Only an Agency Admin admin or higher can access connections');
                if (!profile.agency_admin.includes(connection.agency)) throw new Err(401, null, `You are not an Agency Admin for Agency ${connection.agency}`);

                return { connection, profile, auth };
            }
        } else if (auth.access === AuthResourceAccess.LAYER) {
            const layer = await this.layer(config, auth);
            if (layer.connection !== connectionid) throw new Err(401, null, 'Layer does not belong to this Connection');
            return { auth, connection, layer };
        } else {
            return { auth, connection };
        }
    }

    static async as_resource(config: Config, req: AnyRequest, opts: {
        resources?: Array<AuthResourceAccepted>;
    } = {}): Promise<AuthResource> {
        const auth = await this.is_auth(config, req, opts);

        if (auth instanceof AuthUser) throw new Err(401, null, 'Only a resource token can access this resource');

        return auth;
    }

    static async impersonate(
        config: Config,
        req: AnyRequest,
        impersonate: string,
    ): Promise<AuthUser> {
        const adminUser = await this.as_user(config, req, { admin: true });

        const imp = await config.models.Profile.from(impersonate);

        const resolved = new AuthUser(accessFor(imp), impersonate, adminUser.token);
        resolved.impersonate = adminUser.email;
        return resolved;
    }

    /**
     * The authorized user
     *
     * @param opts.admin    - Require a System Administrator, for routes where only some requests need one
     */
    static async as_user(config: Config, req: AnyRequest, opts: {
        admin?: boolean;
    } = {}): Promise<AuthUser> {
        const auth = this.#granted(req);

        if (auth instanceof AuthResource) throw new Err(401, null, 'Only an authenticated user can access this resource');

        if (opts.admin && auth.access !== AuthUserAccess.ADMIN) {
            throw new Err(401, null, 'User must be a System Administrator to access this resource');
        }

        return auth;
    }

    /**
     * The authenticated user's Profile - a Profile that has been provisioned (SCIM)
     * but has never logged in has no TAK certificate and is rejected
     */
    static async as_profile(config: Config, req: AnyRequest, opts: {
        admin?: boolean;
    } = {}): Promise<AuthenticatedProfile> {
        const user = await this.as_user(config, req, opts);
        return await authenticatedProfile(config, user.email);
    }
}

export function hasScope(permissions: Array<string>, scope: string): boolean {
    const wildcard = scope.slice(0, scope.indexOf(':') + 1) + '*';
    return permissions.includes(scope) || permissions.includes(wildcard);
}

const identities = new WeakMap<object, string>();

/**
 * The verified identity of a request for the request logger
 */
export function identityOf(req: object): string | undefined {
    return identities.get(req);
}

function identify<T extends AuthResource | AuthUser>(req: AnyRequest, auth: T): T {
    const identity = auth instanceof AuthUser
        ? auth.email
        : `${auth.access}:${auth.id ?? 'internal'}`;

    identities.set(req, identity.replace(/[^\x21-\x7E]/g, '_'));

    return auth;
}

async function auth_request(
    config: Config,
    req: AnyRequest,
    source: TokenSource,
): Promise<AuthResource | AuthUser> {
    try {
        const token = req.query && typeof req.query === 'object' && 'token' in req.query ? req.query.token : undefined;

        if (source === 'header') {
            if (!req.headers || !req.header('authorization')) throw new Err(401, null, 'No Auth Present');

            const authorization = (req.header('authorization') || '').split(' ');

            if (authorization[0].toLowerCase() !== 'bearer') {
                throw new Err(401, null, 'Only "Bearer" authorization header is allowed');
            }

            if (!authorization[1]) {
                throw new Err(401, null, 'No bearer token present');
            }

            return identify(req, await tokenParser(config, authorization[1], config.SigningSecret));
        } else if (token && typeof token === 'string') {
            return identify(req, await tokenParser(config, token, config.SigningSecret));
        } else {
            throw new Err(401, null, 'No Auth Present');
        }
    } catch (err) {
        if (err instanceof Error && err.name === 'PublicError') {
            throw err;
        } else {
            throw new Err(401, new Error(String(err)), 'Invalid Token');
        }
    }
}

export async function tokenParser(
    config: Config,
    token: string,
    secret: string,
): Promise<AuthUser | AuthResource> {
    if (token.startsWith('etl.')) {
        token = token.replace(/^etl\./, '');
        const decoded = jwt.verify(token, secret);
        if (typeof decoded === 'string') throw new Err(400, null, 'Decoded JWT Should be Object');
        if (!decoded.access || typeof decoded.access !== 'string') throw new Err(401, null, 'Invalid Token');
        if (!decoded.internal || typeof decoded.internal !== 'boolean') decoded.internal = false;
        if (!decoded.internal && !decoded.id) throw new Err(401, null, 'Invalid Token');

        const access = castResourceAccessEnum(decoded.access);
        if (!access) throw new Err(400, null, 'Invalid Resource Access Value');

        if (access == AuthResourceAccess.PROFILE) {
            if (!decoded.internal) {
                try {
                    await config.models.ProfileToken.from(`etl.${token}`);
                } catch (err) {
                    throw new Err(401, err instanceof Error && err.name === 'PublicError' ? err : new Error(String(err)), 'Token does not exist');
                }
            }

            const profile = await config.models.Profile.from(decoded.id);

            if (profile.disabled) throw new Err(401, null, 'User is disabled');

            return new AuthUser(accessFor(profile), profile.username, `etl.${token}`);
        } else {
            return new AuthResource(`etl.${token}`, access, decoded.id, decoded.internal);
        }
    } else {
        const decoded = jwt.verify(token, secret);
        if (typeof decoded === 'string') throw new Err(400, null, 'Decoded JWT Should be Object');
        if (!decoded.email || typeof decoded.email !== 'string') throw new Err(401, null, 'Invalid Token');
        if (!decoded.access || typeof decoded.access !== 'string') throw new Err(401, null, 'Invalid Token');

        let access = castUserAccessEnum(decoded.access);
        if (!access) throw new Err(400, null, 'Invalid User Access Value');

        const session = typeof decoded.s === 'string' ? decoded.s : undefined;

        // Tokens without an `s` claim are server minted and have no session to check
        if (session) {
            let profileSession;
            try {
                profileSession = await config.models.ProfileSession.from(session);
            } catch (err) {
                throw new Err(401, err instanceof Error && err.name === 'PublicError' ? err : new Error(String(err)), 'Session does not exist');
            }

            if (profileSession.username !== decoded.email) throw new Err(401, null, 'Session does not exist');

            // Session tokens live long enough that the profile, not the claim, decides access
            const profile = await config.models.Profile.from(decoded.email);
            if (profile.disabled) throw new Err(401, null, 'User is disabled');
            access = accessFor(profile);
        }

        return new AuthUser(access, decoded.email, token, session);
    }
}

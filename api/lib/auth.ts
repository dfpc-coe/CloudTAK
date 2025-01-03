import { Request } from 'express';
import Err from '@openaddresses/batch-error';
import jwt from 'jsonwebtoken';
import Config from './config.js';
import { InferSelectModel } from 'drizzle-orm';
import type { Profile, Connection } from './schema.js';

export enum ResourceCreationScope {
    SERVER = 'server',
    USER = 'user'
}

export enum AuthUserAccess {
    ADMIN = 'admin',
    AGENCY = 'agency',
    USER = 'user'
}

function castUserAccessEnum(str: string): AuthUserAccess | undefined {
  const value = AuthUserAccess[str.toUpperCase() as keyof typeof AuthUserAccess];
  return value;
}

export type AuthResourceAccepted = {
    access: AuthResourceAccess;
    id: string | number;
}

export enum AuthResourceAccess {
    DATA = 'data',
    LAYER = 'layer',
    IMPORT = 'import',
    CONNECTION = 'connection'
}

function castResourceAccessEnum(str: string): AuthResourceAccess | undefined {
  const value = AuthResourceAccess[str.toUpperCase() as keyof typeof AuthResourceAccess];
  return value;
}

export class AuthResource {
    id: number | string;
    access: AuthResourceAccess;
    token: string;
    internal: boolean;

    constructor(
        token: string,
        access: AuthResourceAccess,
        id: number | string,
        internal: boolean
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

    // Username of admin doing the impersonating - if this value is populated the calling user is guarenteed to be an admin
    impersonate?: string; 

    constructor(access: AuthUserAccess, email: string) {
        this.access = access;
        this.email = email;
    }

    is_user() {
        return this.email && this.email.length;
    }
}

/**
 * @class
 */
export default class Auth {
    /**
     * Is the requester authenticated - can be either a Resource or User auth
     *
     * @param config    - Server Config
     * @param req       - Express Request
     * @param opts.token        - Should URL query tokens be allowed (usually only for downloads)
     * @param opts.anyResources - Any Resource token can use this endpoint
     * @param resources         - Array of resource types that can use this endpoint
     */
    static async is_auth(config: Config, req: Request<any, any, any, any>, opts: {
        token?: boolean;
        anyResources?: boolean;
        resources?: Array<AuthResourceAccepted>;
    } = {}): Promise<AuthResource | AuthUser> {
        if (!opts.token) opts.token = false;
        if (!opts.resources) opts.resources = [];
        if (!opts.anyResources) opts.anyResources = false;

        const auth = auth_request(config, req, { token: opts.token });

        if (!auth || !auth.access) {
            throw new Err(403, null, 'Authentication Required');
        }

        if (auth instanceof AuthResource) {
            const auth_resource = auth as AuthResource;

            if (opts.anyResources && opts.resources.length) {
                throw new Err(403, null, 'Server cannot specify defined resource access and any resource access together');
            } else if (!opts.anyResources && !opts.resources.length) {
                throw new Err(403, null, 'Resource token cannot access resource');
            }

            if (!auth_resource.internal) {
                try {
                    await config.models.ConnectionToken.from(auth_resource.token);
                } catch (err) {
                    if (err instanceof Error) {
                        throw new Err(403, err.name === 'PublicError' ? err : new Error(String(err)), 'Token does not exist');
                    } else {
                        throw new Err(500, new Error(String(err)), 'Unknown Token Error');
                    }
                }
            }

            if (!opts.anyResources && !opts.resources.some((r) => {
                return r.access === auth_resource.access && r.id === auth_resource.id;
            })) {
                throw new Err(403, null, 'Resource token cannot access this resource');
            }
        }

        return auth;
    }

    static async is_connection(config: Config, req: Request<any, any, any, any>, opts: {
        token?: boolean;
        resources?: Array<AuthResourceAccepted>;
    }, connectionid: number): Promise<{
        auth: AuthResource | AuthUser;
        connection: InferSelectModel<typeof Connection>;
        profile?: InferSelectModel<typeof Profile>;
    }> {
        const auth = await this.is_auth(config, req, opts)

        const connection = await config.models.Connection.from(connectionid);

        if (this.#is_user(auth)) {
            const profile = await this.#as_profile(config, auth as AuthUser);

            if (profile.system_admin === true) {
                return { connection, profile, auth };
            } else {
                if (!connection.agency) throw new Err(401, null, 'Only a System Admin can access this connection');
                if (!profile.agency_admin) throw new Err(401, null, 'Only an Agency Admin admin or higher can access connections');
                if (!profile.agency_admin.includes(connection.agency)) throw new Err(401, null, `You are not an Agency Admin for Agency ${connection.agency}`);

                return { connection, profile, auth };
            }
        } else {
            // If a resource token is used it's up to the caller to specify it is allowed via the resources array
            // is_auth will disallow resource tokens when no resource array is set
            return { auth, connection };
        }
    }

    static async is_user(config: Config, req: Request<any, any, any, any>): Promise<boolean> {
        const auth = await this.is_auth(config, req);
        return this.#is_user(auth);
    }

    static #is_user(auth: AuthResource | AuthUser): boolean {
        return auth instanceof AuthUser;
    }

    static async is_resource(config: Config, req: Request<any, any, any, any>): Promise<boolean> {
        const auth = await this.is_auth(config, req);
        return this.#is_resource(auth);
    }

    static #is_resource(auth: AuthResource | AuthUser): boolean {
        return auth instanceof AuthResource;
    }

    static async as_resource(config: Config, req: Request<any, any, any, any>, opts: {
        anyResources?: boolean;
        resources?: Array<AuthResourceAccepted>;
        token?: boolean;
    } = {}): Promise<AuthResource> {
        if (!opts.token) opts.token = false;
        const auth = await this.is_auth(config, req, opts);

        if (this.#is_user(auth)) throw new Err(401, null, 'Only a resource token can access this resource');

        return auth as AuthResource;
    }

    static async impersonate(
        config: Config,
        req: Request<any, any, any, any>,
        impersonate: string
    ): Promise<AuthUser> {
        const adminUser = await this.as_user(config, req, { admin: true });

        const imp = await config.models.Profile.from(impersonate);

        let access = AuthUserAccess.USER
        if (imp.agency_admin) access = AuthUserAccess.AGENCY;
        if (imp.system_admin) access = AuthUserAccess.ADMIN;

        const resolved = new AuthUser(access, impersonate);
        resolved.impersonate = adminUser.email;
        return resolved;
    }

    static async as_user(config: Config, req: Request<any, any, any, any>, opts: {
        token?: boolean;
        admin?: boolean;
    } = {}): Promise<AuthUser> {
        if (!opts.token) opts.token = false;
        const auth = await this.is_auth(config, req, { token: opts.token });

        if (this.#is_resource(auth)) throw new Err(401, null, 'Only an authenticated user can access this resource');

        const user = auth as AuthUser;

        if (opts.admin && user.access !== AuthUserAccess.ADMIN) {
            throw new Err(401, null, 'User must be a System Administrator to access this resource');
        }

        return user;
    }

    static async #as_profile(config: Config, user: AuthUser): Promise<InferSelectModel<typeof Profile>> {
        return await config.models.Profile.from(user.email);
    }

    static async as_profile(config: Config, req: Request<any, any, any, any>, opts: {
        token?: boolean;
        admin?: boolean;
    } = {}): Promise<InferSelectModel<typeof Profile>> {
        const user = await this.as_user(config, req, opts);
        return await this.#as_profile(config, user);
    }
}

function auth_request(config: Config, req: Request<any, any, any, any>, opts?: {
    token: boolean
}): AuthResource | AuthUser {
    try {
        if (req.headers && req.header('authorization')) {
            const authorization = (req.header('authorization') || '').split(' ');

            if (authorization[0].toLowerCase() !== 'bearer') {
                throw new Err(401, null, 'Only "Bearer" authorization header is allowed')
            }

            if (!authorization[1]) {
                throw new Err(401, null, 'No bearer token present');
            }

            try {
                return tokenParser(authorization[1], config.SigningSecret);
            } catch (err) {
                if (config.unsafe) {
                    return tokenParser(authorization[1], config.UnsafeSigningSecret);
                } else {
                    throw err;
                }
            }
        } else if (
            opts
            && opts.token
            && req.query
            && req.query.token
            && typeof req.query.token === 'string'
        ) {
            try {
                return tokenParser(req.query.token, config.SigningSecret);
            } catch (err) {
                if (config.unsafe) {
                    return tokenParser(req.query.token, config.UnsafeSigningSecret);
                } else {
                    throw err;
                }
            }
        } else {
            throw new Err(401, null, 'No Auth Present')
        }
    } catch (err) {
        if (err instanceof Error && err.name === 'PublicError') {
            throw err;
        } else {
            throw new Err(401, new Error(String(err)), 'Invalid Token')
        }
    }
}

export function tokenParser(token: string, secret: string): AuthUser | AuthResource {
    if (token.startsWith('etl.')) {
        token = token.replace(/^etl\./, '');
        const decoded = jwt.verify(token, secret);
        if (typeof decoded === 'string') throw new Err(400, null, 'Decoded JWT Should be Object');
        if (!decoded.access || typeof decoded.access !== 'string') throw new Err(401, null, 'Invalid Token');
        if (!decoded.internal || typeof decoded.internal !== 'boolean') decoded.internal = false;
        if (!decoded.id) throw new Err(401, null, 'Invalid Token');
        const access = castResourceAccessEnum(decoded.access);
        if (!access) throw new Err(400, null, 'Invalid Resource Access Value');
        return new AuthResource(`etl.${token}`, access, decoded.id, decoded.internal);
    } else {
        const decoded = jwt.verify(token, secret);
        if (typeof decoded === 'string') throw new Err(400, null, 'Decoded JWT Should be Object');
        if (!decoded.email || typeof decoded.email !== 'string') throw new Err(401, null, 'Invalid Token');
        if (!decoded.access || typeof decoded.access !== 'string') throw new Err(401, null, 'Invalid Token');

        const access = castUserAccessEnum(decoded.access);
        if (!access) throw new Err(400, null, 'Invalid User Access Value');

        const auth: {
            access: AuthUserAccess;
            email: string;
        } = {
            email: decoded.email,
            access
        };

        return new AuthUser(auth.access, auth.email);
    }
}


import Err from '@openaddresses/batch-error';
import {
    AuthRequest,
    AuthUser,
    AuthResource, AuthResourceAccess
} from '@tak-ps/blueprint-login';
import Models from './models.js';

export type AuthResourceAccepted = {
    access: AuthResourceAccess;
    id: string | number;
}

/**
 * @class
 */
export default class Auth {
    /**
     * Is the requester authenticated - can be either a Resource or User auth
     *
     * @param {Object} req Express Request
     * @param {boolean} token Should URL query tokens be allowed (usually only for downloads)
     */
    static async is_auth(models: Models, req: AuthRequest, opts: {
        token?: boolean;
        anyResources?: boolean;
        resources?: Array<AuthResourceAccepted>;
    } = {}): Promise<boolean> {
        if (!opts.token) opts.token = false;
        if (opts.token && req.token) req.auth = req.token;
        if (!opts.resources) opts.resources = [];
        if (!opts.anyResources) opts.anyResources = false;

        if (!req.auth || !req.auth.access) {
            throw new Err(403, null, 'Authentication Required');
        }

        if (req.auth instanceof AuthResource) {
            if (opts.anyResources && opts.resources.length) {
                throw new Err(403, null, 'Server cannot specify defined resource access any resource access together');
            } else if (!opts.anyResources && !opts.resources.length) {
                throw new Err(403, null, 'Resource token cannot access resource');
            }

            if (!req.auth.internal) {
                try {
                    await models.ConnectionToken.from(req.auth.token);
                } catch (err) {
                    throw new Err(403, err, 'Token does not exist');
                }
            }

            if (!opts.anyResources && !opts.resources.some((r) => {
                return r.access === req.auth.access && r.id === req.auth.id;
            })) {
                throw new Err(403, null, 'Resource token cannot access this resource');
            }
        }

        return true;
    }

    static is_user(req: AuthRequest): boolean {
        return req.auth instanceof AuthUser;
    }

    static is_resource(req: AuthRequest): boolean {
        return req.auth instanceof AuthResource;
    }

    static async as_resource(models: Models, req: AuthRequest, opts: {
        token?: boolean;
    } = {}): Promise<AuthResource> {
        if (!opts.token) opts.token = false;
        await this.is_auth(models, req, opts);

        if (this.is_user(req)) throw new Err(401, null, 'Only a resource token can access this resource');

        return req.auth as AuthResource;
    }

    static async as_user(models: Models, req: AuthRequest, opts: {
        token?: boolean;
    } = {}): Promise<AuthUser> {
        if (!opts.token) opts.token = false;
        await this.is_auth(models, req, opts);

        if (this.is_resource(req)) throw new Err(401, null, 'Only an authenticated user can access this resource');

        return req.auth as AuthUser;
    }
}

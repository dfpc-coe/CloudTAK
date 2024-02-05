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
        resources?: Array<AuthResourceAccepted>;
    } = {}): Promise<boolean> {
        if (!opts.token) opts.token = false;

        if (opts.token && req.token) req.auth = req.token;

        if (!req.auth || !req.auth.access) {
            throw new Err(403, null, 'Authentication Required');
        }

        if (req.auth instanceof AuthResource) {
            if (!opts.resources || !opts.resources.length) throw new Err(403, null, 'Resource token cannot access resource');

            if (!req.auth.internal) {
                try {
                    await models.ConnectionToken.from(req.auth.token);
                } catch (err) {
                    throw new Err(403, err, 'Token does not exist');
                }
            }

            if (!opts.resources.some((r) => {
                return r.access === req.auth.access && r.id === req.auth.id;
            })) {
                throw new Err(403, null, 'Resource token cannot access this resource');
            }
        }

        return true;
    }

    static async is_user(models: Models, req: AuthRequest, opts: {
        token?: boolean;
    } = {}): Promise<AuthUser> {
        if (!opts.token) opts.token = false;
        await this.is_auth(models, req, opts);

        if (req.auth instanceof AuthResource) throw new Err(401, null, 'Only an authenticated user can access this resource');

        return req.auth;
    }
}

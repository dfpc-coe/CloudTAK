import Err from '@openaddresses/batch-error';
import { AuthRequest, AuthUser, AuthResource } from '@tak-ps/blueprint-login';
import Models from './models.js';

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
    }): Promise<boolean> {
        if (!opts.token) opts.token = false;

        if (opts.token && req.token) req.auth = req.token;

        if (!req.auth || !req.auth.access) {
            throw new Err(403, null, 'Authentication Required');
        }

        return true;
    }

    static async is_user(models: Models, req: AuthRequest, opts: {
        token?: boolean;
    }): Promise<AuthUser> {
        if (!opts.token) opts.token = false;
        await this.is_auth(models, req, opts);

        if (req.auth instanceof AuthResource) throw new Err(401, null, 'Only an authenticated user can access this resource');

        return req.auth;
    }

    /**
     * Is the request from a task lambda function
     *
     * @param {Object} req Express Request
     * @param {Number} layer Expected Layer
     */
    static async is_resource(req: AuthRequest, layer: number) {
        await this.is_auth(req);

        if (req.auth.access !== 'cot')  throw new Err(400, null, 'Token must have "cot" access');
        if (req.auth instanceof AuthUser && req.auth.layer !== layer)  throw new Err(400, null, 'Token is not valid for this layer');

        return true;
    }

    /**
     * Is the request from a task lambda function
     *
     * @param {Object} req Express Request
     * @param {Number} data Expected Data
     */
    static async is_data(req: AuthRequest, data: number) {
        await this.is_auth(req);

        if (req.auth.access !== 'cot')  throw new Err(400, null, 'Token must have "data" access');
        // @ts-expect-error TODO: Update auth type
        if (req.auth.data !== data)  throw new Err(400, null, 'Token is not valid for this data source');

        return true;
    }
}

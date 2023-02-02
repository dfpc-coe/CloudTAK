// @ts-ignore
import Err from '@openaddresses/batch-error';
import { Request } from 'express';

/**
 * @class
 */
export default class Auth {
    /**
     * Is the user authenticated
     *
     * @param {Object} req Express Request
     * @param {boolean} token Should URL query tokens be allowed (usually only for downloads)
     */
    static async is_auth(req: Request, token: boolean = false) {
        // @ts-ignore
        if (token && req.token) req.auth = req.token;

        // @ts-ignore
        if (!req.auth || !req.auth.access) {
            throw new Err(403, null, 'Authentication Required');
        }

        // @ts-ignore
        if (req.auth.disabled) {
            throw new Err(403, null, 'Account Disabled - Please Contact Us');
        }

        return true;
    }

    /**
     * Is the request from a task lambda function
     *
     * @param {Object} req Express Request
     * @param {Number} layer Expected Layer
     */
    static async is_layer(req: Request, layer: number) {
        await this.is_auth(req);

        // @ts-ignore
        if (req.auth.access !== 'cot')  throw new Err(400, null, 'Token must have "cot" access');
        // @ts-ignore
        if (req.auth.layer !== layer)  throw new Err(400, null, 'Token is not valid for this layer');

        return true;
    }
}

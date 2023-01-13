import Err from '@openaddresses/batch-error';

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
    static async is_auth(req, token = false) {
        if (token && req.token) req.auth = req.token;

        if (!req.auth || !req.auth.access) {
            throw new Err(403, null, 'Authentication Required');
        }

        if (req.auth.disabled) {
            throw new Err(403, null, 'Account Disabled - Please Contact Us');
        }

        return true;
    }

    /**
     * Is the request from a task lambda function
     *
     * @param {Object} req Express Request
     */
    static async is_layer(layer, req) {
        await this.is_auth(req);

        if (req.auth.access !== 'cot')  throw new Err(400, null, 'Token must have "cot" access');
        if (req.auth.layer !== layer)  throw new Err(400, null, 'Token is not valid for this layer');

        return true;
    }
}

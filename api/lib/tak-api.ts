import Mission from './api/mission.js';
import MissionLog from './api/mission-log.js';
import Credentials from './api/credentials.js';
import Contacts from './api/contacts.js';
import Files from './api/files.js';
import Group from './api/groups.js';
import Err from '@openaddresses/batch-error';
import * as auth from './tak-auth.js';
export * from './tak-auth.js';

/**
 * Handle TAK HTTP API Operations
 * @class
 */
export default class TAKAPI {
    auth: auth.APIAuth;
    url: URL;
    Mission: Mission;
    MissionLog: MissionLog;
    Credentials: Credentials;
    Contacts: Contacts;
    Group: Group;
    Files: Files;

    constructor(url: URL, auth: auth.APIAuth) {
        this.url = url;
        this.auth = auth;

        this.Mission = new Mission(this);
        this.MissionLog = new MissionLog(this);
        this.Credentials = new Credentials(this);
        this.Contacts = new Contacts(this);
        this.Group = new Group(this);
        this.Files = new Files(this);
    }

    static async init(url: URL, auth: auth.APIAuth): Promise<TAKAPI> {
        const api = new TAKAPI(url, auth);

        await api.auth.init(api.url);

        return api;
    }

    stdurl(url: string | URL) {
        try {
            url = new URL(url);
        } catch (err) {
            url = new URL(url, this.url);
        }

        return url;
    }

    /**
     * Standardize interactions with the backend API
     *
     * @param {URL|String} url      - Full URL or API fragment to request
     * @param {Object} [opts={}]    - Options
     */
    async fetch(url: URL, opts: any = {}, raw=false) {
        url = this.stdurl(url);

        try {
            if (!opts.headers) opts.headers = {};

            if (
                (isPlainObject(opts.body) || Array.isArray(opts.body))
                && (
                    !opts.headers['Content-Type']
                    || opts.headers['Content-Type'].startsWith('application/json')
                )
            ) {
                opts.body = JSON.stringify(opts.body);
                opts.headers['Content-Type'] = 'application/json';
            }

            const res = await this.auth.fetch(this, url, opts)

            if (raw) return res;

            let bdy: any = {};
            if ((res.status < 200 || res.status >= 400)) {
                try {
                    bdy = await res.text();
                } catch (err) {
                    bdy = null;
                }

                throw new Err(res.status, null, bdy || `Status Code: ${res.status}`);
            }

            if (res.headers.get('content-type') === 'application/json') {
                return await res.json();
            } else {
                return await res.text();
            }
        } catch (err) {
            if (err.name === 'PublicError') throw err;
            throw new Err(400, null, err instanceof Error ? err.message : String(err));
        }
    }
}

function isPlainObject(value: object) {
    return  value?.constructor === Object;
}

import FormData from 'form-data';
import OAuth from './api/oauth.js';
import Package from './api/package.js';
import Query from './api/query.js';
import Mission from './api/mission.js';
import MissionLog from './api/mission-log.js';
import MissionLayer from './api/mission-layer.js';
import Credentials from './api/credentials.js';
import Contacts from './api/contacts.js';
import Files from './api/files.js';
import Group from './api/groups.js';
import Subscription from './api/subscriptions.js';
import Video from './api/video.js';
import Export from './api/export.js';
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
    Package: Package;
    OAuth: OAuth;
    Mission: Mission;
    MissionLog: MissionLog;
    MissionLayer: MissionLayer;
    Credentials: Credentials;
    Contacts: Contacts;
    Subscription: Subscription;
    Group: Group;
    Video: Video;
    Export: Export;
    Query: Query;
    Files: Files;

    constructor(url: URL, auth: auth.APIAuth) {
        this.url = url;
        this.auth = auth;

        this.Query = new Query(this);
        this.Package = new Package(this);
        this.OAuth = new OAuth(this);
        this.Export = new Export(this);
        this.Mission = new Mission(this);
        this.MissionLog = new MissionLog(this);
        this.MissionLayer = new MissionLayer(this);
        this.Credentials = new Credentials(this);
        this.Contacts = new Contacts(this);
        this.Subscription = new Subscription(this);
        this.Group = new Group(this);
        this.Video = new Video(this);
        this.Files = new Files(this);
    }

    static async init(url: URL, auth: auth.APIAuth): Promise<TAKAPI> {
        const api = new TAKAPI(url, auth);

        await api.auth.init(api);

        return api;
    }

    stdurl(url: string | URL) {
        try {
            url = new URL(url);
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
            } else if (opts.body instanceof FormData) {
                opts.headers = opts.body.getHeaders();
            } else if (opts.body instanceof URLSearchParams) {
                opts.headers['Content-Type'] = 'application/x-www-form-urlencoded'
                opts.body = String(opts.body);
            }

            const res = await this.auth.fetch(this, url, opts)

            if (raw) return res;

            let bdy: any = {};

            if ((res.status < 200 || res.status >= 400)) {
                try {
                    bdy = await res.text();
                } catch (err) {
                    console.error(err);
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
            if (err instanceof Error && err.name === 'PublicError') throw err;
            throw new Err(400, null, err instanceof Error ? err.message : String(err));
        }
    }
}

function isPlainObject(value: object) {
    return  value?.constructor === Object;
}

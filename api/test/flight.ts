process.env.StackName = 'test';
process.env.MartiAPI = 'https://example.com';
process.env.AuthGroup = 'Admins';

import assert from 'assert';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import api from '../index.js';
import Config from '../lib/config.js';
import drop from './drop.js';
import { pathToRegexp } from 'path-to-regexp';
import test from 'tape';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import * as pgschema from '../lib/schema.js';
import { Pool } from '@openaddresses/batch-generic';
const ajv = addFormats(new Ajv({ allErrors: true }));

/**
 * @class
 */
class FlightResponse {
    res: any;
    ok: boolean;
    headers: Map<string, string>;
    status: number;
    body: any;

    constructor(res: any, body: any) {
        this.res = res;

        this.ok = res.ok;
        this.headers = res.headers;
        this.status = res.status;
        this.body = body;
    }
}

/**
 * @class
 */
export default class Flight {
    config?: Config;
    srv?: any; // TODO: HTTP Server
    base: string;
    schema?: object;
    routes: {
        [k: string]: RegExp;
    }
    token: {
        [k: string]: string;
    }

    constructor() {
        this.base = 'http://localhost:5001';
        this.token = {};
        this.routes = {};
    }

    /**
     * Clear and restore an empty database schema
     *
     * @param {boolean} dropdb Should the database be dropped
     */
    init(dropdb = true) {
        test('start: database', async (t) => {
            try {
                if (dropdb) {
                    const connstr = process.env.POSTGRES || 'postgres://postgres@localhost:5432/tak_ps_etl_test';
                    await drop(connstr);
                    const pool = await Pool.connect(connstr, {
                        migrationsFolder: (new URL('../migrations', import.meta.url)).pathname,
                        schema: pgschema
                    });
                    // @ts-expect-error Not present in type def
                    pool.session.client.end();
                }
            } catch (err) {
                t.error(err);
            }

            this.schema = JSON.parse(String(fs.readFileSync(new URL('./fixtures/get_schema.json', import.meta.url))));

            for (const route of Object.keys(this.schema)) {
                this.routes[route] = new RegExp(pathToRegexp(route.split(' ').join(' /api')));
            }

            t.end();
        });
    }

    /**
     * Make a fetch using a JSON fixture
     *
     * @param {String} name Name of fixture present in the ./fixtures folder (Should be JSON)
     * @param {String} auth Name of the token that will be used to make the fetch
     */
    fixture(name: string, auth: string) {
        test(`Fixture: ${name}`, async (t) => {
            const req = JSON.parse(String(fs.readFileSync(new URL('./fixtures/' + name, import.meta.url))));
            if (auth) req.auth = {
                bearer: this.token[auth]
            };

            try {
                await this.fetch(req.url, req, true);
            } catch (err) {
                t.error(err, 'no errors');
            }

            t.end();
        });
    }

    /**
     * Request data from the API & Ensure the output schema matches the response
     *
     * @param {String} url URL to fetch
     * @param {Object} req Request Object
     * @param {boolean|object} t If true validate schema & use defaults. If false, don't validate schema and use defaults
     * @param {boolean} [t.verify] Verify Schema Validation
     * @param {boolean} [t.json=true] Expect JSON in response
     */
    async fetch(url: string, req: any, t: boolean | {
        verify: boolean;
        json: true;
    }): Promise<any> {
        if (t === undefined) throw new Error('flight.fetch requires two arguments - pass (<url>, <req>, false) to disable schema testing');

        const defs = {
            verify: false,
            json: true
        };

        if (t === true) {
            defs.verify = true;
        } else if (t === false) {
            defs.verify = false;
        } else {
            Object.assign(defs, t);
        }

        const parsedurl = new URL(url, this.base);

        if (!req.headers) req.headers = {};
        if (req.body && req.body.constructor === Object) {
            req.headers['Content-Type'] = 'application/json';
            req.body = JSON.stringify(req.body);
        }

        if (req.auth && req.auth.bearer) {
            req.headers['Authorization'] = `Bearer ${req.auth.bearer}`;
        } else if (req.auth && req.auth.username && req.auth.password) {
            req.headers['Authorization'] = 'Basic ' + btoa(req.auth.username + ':' + req.auth.password);
        }
        delete req.auth;

        if (!defs.verify) {
            const _res = await fetch(parsedurl, req);
            const body = defs.json ? await _res.json() : await _res.text();
            const res = new FlightResponse(_res, body);
            return res;
        }


        if (!req.method) req.method = 'GET';

        let match: string;
        const spath = `${req.method.toUpperCase()} ${parsedurl.pathname}/`;
        const matches = [];
        for (const r of Object.keys(this.routes)) {
            if (spath.match(this.routes[r])) {
                matches.push(r);
            }
        }

        if (!matches.length) {
            assert.fail(`Cannot find schema match for: ${spath}`);
            return;
        } else if (matches.length === 1) {
            match = matches[0];
        } else {
            // TODO multiple selection - default to first one defined in routes to mirror express behabior
            match = matches[0];
        }

        const schemaurl = new URL('/api/schema', this.base);
        schemaurl.searchParams.append('method', match.split(' ')[0]);
        schemaurl.searchParams.append('url', match.split(' ')[1]);

        const rawschema = await (await fetch(schemaurl)).json();

        if (!rawschema.res) throw new Error('Cannot validate resultant schema - no result schema defined');

        const schema = ajv.compile(rawschema.res);
        const _res = await fetch(parsedurl, req);
        const res = new FlightResponse(_res, await _res.json());

        if (res.ok) {
            schema(res.body);

            if (!schema.errors) return res;

            for (const error of schema.errors) {
                assert.fail(`${error.schemaPath}: ${error.message}`);
            }
        } else {
            // Just print the body instead of spewing
            // 100 schema validation errors for an error response
            assert.fail(JSON.stringify(res.body));
        }

        return res;
    }

    /**
     * Bootstrap a new server test instance
     *
     * @param {Object} custom custom config options
     */
    takeoff(custom = {}) {
        test('test server takeoff', async (t) => {
            this.config = await Config.env({
                postgres: process.env.POSTGRES || 'postgres://postgres@localhost:5432/tak_ps_etl_test',
                silent: true,
                unsafe: true,
                noevents: true,
                nosinks: true,
                nocache: true,
                nometrics: true,
                local: true
            });

            Object.assign(this.config, custom);

            this.config.models.Server.generate({
                name: 'Test Runner',
                url: 'ssl://tak.example.com',
                auth: {
                    cert: 'cert-123',
                    key: 'key-123'
                },
                api: 'http://tak-api.example.com'
            });

            this.srv = await api(this.config);

            t.end();
        });
    }

    /**
     * Create a new user and return an API token for that user
     */
    user() {
        test('Create User: admin', async (t) => {
            this.config.models.Profile.generate({
                username: 'test@example.com',
                system_admin: true,
                auth: { cert: 'cert123', key: 'key123' },
            });
            this.token.admin = jwt.sign({ access: 'admin', email: 'test@example.com' }, 'coe-wildland-fire')
            t.end();
        });
    }

    /**
     * Shutdown an existing server test instance
     */
    landing() {
        test('test server landing - api', (t) => {
            this.srv.close(async () => {
                // @ts-expect-error not present in type def
                this.config.pg.session.client.end();
                this.config.cacher.end();
                delete this.config;
                delete this.srv;
                t.end();
            });
        });
    }
}


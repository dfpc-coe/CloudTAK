import Err from '@openaddresses/batch-error';
import STS from '@aws-sdk/client-sts';
import { UserManager } from './interface-user.js';
import { WeatherManager } from './interface-weather.js';
import SecretsManager from '@aws-sdk/client-secrets-manager';
import EventsPool from './events-pool.js';
import { Pool, GenerateUpsert } from '@openaddresses/batch-generic';
import ConnectionPool from './connection-pool.js';
import ConnectionGeofence from './connection-geofence.js';
import type { HubClient } from './hub/index.js';
import LocalHub from './hub/local.js';
import RemoteHub from './hub/remote.js';

/**
 * Which servers this process hosts:
 * - `both`: REST API + stateful resources in one process (docker-compose, tests, dev)
 * - `api`:  stateless REST API only - stateful interactions proxy to a hub over RPC
 * - `hub`:  stateful server only - web WebSockets, TAK connection pool, crons, geofence
 */
export type ServerMode = 'both' | 'api' | 'hub';

const SERVER_MODES: ServerMode[] = ['both', 'api', 'hub'];
import { ConnectionWebSocket } from './connection-web.js';
import type { Server } from './schema.js';
import { type InferSelectModel } from 'drizzle-orm';
import Models from './models.js';
import process from 'node:process';
import * as pgtypes from './schema.js';

interface ConfigArgs {
    silent: boolean;
    postgres: string;
    noevents: boolean;
    nosinks: boolean;
    nogeofence?: boolean;
    nocache: boolean;
    mode?: ServerMode;
    hubUrl?: string;
}

export default class Config {
    silent: boolean;
    noevents: boolean;
    nosinks: boolean;
    nogeofence: boolean;
    nocache: boolean;
    models: Models;
    StackName: string;
    SigningSecret: string;
    user?: UserManager;
    weather: WeatherManager;
    API_URL: string;
    PMTILES_URL: string;
    Bucket?: string;
    pg: Pool<typeof pgtypes>;
    server: InferSelectModel<typeof Server>;
    mode: ServerMode;
    hub: HubClient;
    arnPrefix?: string;

    /**
     * Stateful resources - only constructed when this process hosts the
     * hub (mode `both` or `hub`); the public getters fail loudly so a
     * stateless `api` process can never silently touch them
     */
    #wsClients?: Map<string, ConnectionWebSocket[]>;
    #conns?: ConnectionPool;
    #geofence?: ConnectionGeofence;
    #events?: EventsPool;

    constructor(init: {
        silent: boolean;
        noevents: boolean;
        nosinks: boolean;
        nogeofence: boolean;
        nocache: boolean;
        models: Models;
        StackName: string;
        API_URL: string;
        PMTILES_URL: string;
        SigningSecret: string;
        wsClients: Map<string, ConnectionWebSocket[]>;
        pg: Pool<typeof pgtypes>;
        server: InferSelectModel<typeof Server>;
        Bucket?: string;
        mode?: ServerMode;
        hubUrl?: string;
    }) {
        this.silent = init.silent;
        this.noevents = init.noevents;
        this.nosinks = init.nosinks;
        this.nogeofence = init.nogeofence;
        this.nocache = init.nocache;
        this.models = init.models;
        this.StackName = init.StackName;
        this.SigningSecret = init.SigningSecret;
        this.API_URL = init.API_URL;
        this.PMTILES_URL = init.PMTILES_URL;
        this.pg = init.pg;
        this.Bucket = init.Bucket;
        this.server = init.server;
        this.mode = init.mode || 'both';

        if (this.mode === 'api') {
            if (!init.hubUrl) throw new Error('CLOUDTAK_Hub_URL must be set when CLOUDTAK_Server_Mode is api');
            this.hub = new RemoteHub(this, init.hubUrl);
        } else {
            this.#wsClients = init.wsClients;
            this.#conns = new ConnectionPool(this);
            this.#geofence = new ConnectionGeofence(this);
            this.#events = new EventsPool(this.StackName);

            this.hub = new LocalHub(this);
        }

        this.weather = new WeatherManager();
    }

    get wsClients(): Map<string, ConnectionWebSocket[]> {
        if (!this.#wsClients) throw new Error(`WebSocket Clients are not available in '${this.mode}' server mode`);
        return this.#wsClients;
    }

    get conns(): ConnectionPool {
        if (!this.#conns) throw new Error(`Connection Pool is not available in '${this.mode}' server mode`);
        return this.#conns;
    }

    get geofence(): ConnectionGeofence {
        if (!this.#geofence) throw new Error(`Geofence is not available in '${this.mode}' server mode`);
        return this.#geofence;
    }

    get events(): EventsPool {
        if (!this.#events) throw new Error(`Events Pool is not available in '${this.mode}' server mode`);
        return this.#events;
    }

    serverCert(): {
        cert: string;
        key: string;
    } {
        if (!this.server.auth.cert) throw new Err(500, null, 'Server auth.cert not set');
        if (!this.server.auth.key) throw new Err(500, null, 'Server auth.key not set');

        return {
            cert: this.server.auth.cert,
            key: this.server.auth.key,
        };
    }

    static async env(args: ConfigArgs): Promise<Config> {
        if (!process.env.AWS_REGION) {
            process.env.AWS_REGION = 'us-east-1';
        }

        const mode = (args.mode || process.env.CLOUDTAK_Server_Mode || 'both') as ServerMode;
        if (!SERVER_MODES.includes(mode)) {
            throw new Error(`CLOUDTAK_Server_Mode must be one of: ${SERVER_MODES.join(', ')}`);
        }

        const hubUrl = args.hubUrl || process.env.CLOUDTAK_Hub_URL;

        // Validate before any connection pools are created - a throw from
        // the constructor below would leak them
        if (mode === 'api' && !hubUrl) {
            throw new Error('CLOUDTAK_Hub_URL must be set when CLOUDTAK_Server_Mode is api');
        }

        let SigningSecret, API_URL, PMTILES_URL, Bucket;
        if (!process.env.StackName || process.env.StackName === 'test') {
            process.env.StackName = 'test';

            SigningSecret = process.env.SigningSecret || 'coe-wildland-fire';
            Bucket = process.env.ASSET_BUCKET;
            API_URL = process.env.API_URL || 'http://localhost:5001';
            PMTILES_URL = process.env.PMTILES_URL || 'http://localhost:5001';
        } else {
            if (!process.env.StackName) throw new Error('StackName env must be set');
            if (!process.env.API_URL) throw new Error('API_URL env must be set');
            if (!process.env.ASSET_BUCKET) throw new Error('ASSET_BUCKET env must be set');

            API_URL = process.env.API_URL;

            const apiUrl = new URL(process.env.API_URL);
            if (apiUrl.hostname === 'localhost') {
                PMTILES_URL = process.env.PMTILES_URL || 'http://localhost:5001';
            } else {
                const url = new URL(process.env.API_URL);
                PMTILES_URL = process.env.PMTILES_URL || `https://tiles.${url.host}`;
            }

            Bucket = process.env.ASSET_BUCKET;
            SigningSecret = process.env.SigningSecret || await Config.fetchSecret(process.env.StackName, 'secret');
        }

        const pg: Pool<typeof pgtypes> = await Pool.connect(args.postgres, pgtypes, {
            ssl: process.env.StackName === 'test' ? undefined : { rejectUnauthorized: false },
            migrationsFolder: (new URL('../migrations', import.meta.url)).pathname,
        });

        const models = new Models(pg);

        let server: InferSelectModel<typeof Server>;
        try {
            server = await models.Server.from(1);
        } catch (err) {
            console.log(`ok - no server config found: ${err instanceof Error ? err.message : String(err)}`);

            server = await models.Server.generate({
                name: 'Default Server',
                url: 'ssl://localhost:8089',
                api: 'https://localhost:8443',
            });
        }

        const config = new Config({
            silent: (args.silent || false),
            noevents: (args.noevents || false),
            nosinks: (args.nosinks || false),
            nogeofence: (args.nogeofence || false),
            nocache: (args.nocache || false),
            StackName: process.env.StackName,
            wsClients: new Map(),
            server, SigningSecret, API_URL, Bucket, pg, models, PMTILES_URL,
            mode, hubUrl,
        });

        if (!config.silent) {
            console.error(`ok - set env AWS_REGION: ${process.env.AWS_REGION}`);
            console.log(`ok - PMTiles: ${config.PMTILES_URL}`);
            console.error(`ok - StackName: ${config.StackName}`);
        }

        config.user = new UserManager(config);
        await config.user.init();

        for (const envkey in process.env) {
            if (!envkey.startsWith('CLOUDTAK')) continue;

            // TODO Strongly type via the Type in routes/config
            if (envkey.startsWith('CLOUDTAK_Config_')) {
                const key = envkey.replace(/^CLOUDTAK_Config_/, '').replace(/_/g, '::');
                console.error(`ok - Updating ${key} with value from environment`);
                await config.models.Setting.generate({
                    key,
                    value: process.env[envkey],
                }, {
                    upsert: GenerateUpsert.UPDATE,
                });
            }
        }

        return config;
    }

    /**
     * Return a prefix to an ARN
     */
    async fetchArnPrefix(service = ''): Promise<string> {
        if (this.arnPrefix) {
            return this.arnPrefix;
        } else {
            const sts = new STS.STSClient({ region: process.env.AWS_REGION });
            const account = await sts.send(new STS.GetCallerIdentityCommand({}));
            const res = [];

            if (!account.Arn) throw new Error('ARN Could not be determined');

            res.push(...account.Arn.split(':').splice(0, 2));
            res.push(service);
            res.push(process.env.AWS_REGION);
            res.push(...account.Arn.split(':').splice(4, 1));
            this.arnPrefix = res.join(':');

            return this.arnPrefix;
        }
    }

    static async fetchSecret(
        StackName: string,
        Secret: string,
    ): Promise<string> {
        const secrets = new SecretsManager.SecretsManagerClient({ region: process.env.AWS_REGION });

        const secret = await secrets.send(new SecretsManager.GetSecretValueCommand({
            SecretId: `${StackName}/api/${Secret}`,
        }));

        return secret.SecretString || '';
    }
}

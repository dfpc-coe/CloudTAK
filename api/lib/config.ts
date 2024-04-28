import STS from '@aws-sdk/client-sts';
import External from './external.js';
import SecretsManager from '@aws-sdk/client-secrets-manager';
import type EventsPool from './events-pool.js';
import { Pool } from '@openaddresses/batch-generic';
import ConnectionPool from './connection-pool.js';
import { ConnectionWebSocket } from './connection-web.js';
import Cacher from './cacher.js';
import { Server } from './schema.js';
import { type InferSelectModel } from 'drizzle-orm';
import Models from './models.js';
import process from 'node:process';
import * as pgtypes from './schema.js';

interface ConfigArgs {
    silent: boolean,
    postgres: string,
    unsafe: boolean,
    noevents: boolean,
    nosinks: boolean,
    nocache: boolean,
    nometrics: boolean,
    local: boolean
}

export default class Config {
    local: boolean;
    silent: boolean;
    unsafe: boolean;
    noevents: boolean;
    nometrics: boolean;
    nosinks: boolean;
    nocache: boolean;
    models: Models;
    StackName: string;
    HookURL?: string;
    SigningSecret: string;
    external: External;
    UnsafeSigningSecret: string;
    MartiAPI: string;
    AuthGroup: string;
    API_URL: string;
    PMTILES_URL: string;
    TileBaseURL: URL;
    DynamoDB?: string;
    wsClients: Map<string, ConnectionWebSocket[]>;
    Bucket?: string;
    pg: Pool<typeof pgtypes>;
    cacher: Cacher;
    conns: ConnectionPool;
    server: InferSelectModel<typeof Server>;
    events?: EventsPool;

    constructor(init: {
        local: boolean;
        silent: boolean;
        unsafe: boolean;
        noevents: boolean;
        nometrics: boolean;
        nosinks: boolean;
        nocache: boolean;
        models: Models;
        StackName: string;
        API_URL: string;
        PMTILES_URL: string;
        TileBaseURL: URL;
        SigningSecret: string;
        wsClients: Map<string, ConnectionWebSocket[]>;
        pg: Pool<typeof pgtypes>;
        server: InferSelectModel<typeof Server>;
        MartiAPI: string;
        AuthGroup: string;
        DynamoDB?: string;
        Bucket?: string;
        HookURL?: string;
    }) {
        this.local = init.local;
        this.silent = init.silent;
        this.unsafe = init.unsafe;
        this.noevents = init.noevents;
        this.nometrics = init.nometrics;
        this.nosinks = init.nosinks;
        this.nocache = init.nocache;
        this.models = init.models;
        this.StackName = init.StackName;
        this.UnsafeSigningSecret = 'coe-wildland-fire';
        this.SigningSecret = init.SigningSecret;
        this.API_URL = init.API_URL;
        this.PMTILES_URL = init.PMTILES_URL;
        this.TileBaseURL = init.TileBaseURL;
        this.wsClients = init.wsClients;
        this.pg = init.pg;
        this.MartiAPI = init.MartiAPI;
        this.AuthGroup = init.AuthGroup;
        this.DynamoDB = init.DynamoDB;
        this.Bucket = init.Bucket;
        this.server = init.server;
        this.HookURL = init.HookURL;

        this.conns = new ConnectionPool(this);
        this.cacher = new Cacher(this.nocache, this.silent);
        this.external = new External(this)
    }

    static async env(args: ConfigArgs): Promise<Config> {
        if (!process.env.AWS_DEFAULT_REGION) {
            process.env.AWS_DEFAULT_REGION = 'us-east-1';
        }

        if (!process.env.MartiAPI) throw new Error('MartiAPI env must be set');

        let SigningSecret, API_URL, DynamoDB, Bucket, HookURL;
        if (!process.env.StackName || process.env.StackName === 'test') {
            process.env.StackName = 'test';

            SigningSecret = 'coe-wildland-fire';
            API_URL = 'http://localhost:5001';
            Bucket = process.env.ASSET_BUCKET;
        } else {
            if (args.local) throw new Error('local option cannot be used in production mode - Set StackName=test');
            if (!process.env.StackName) throw new Error('StackName env must be set');
            if (!process.env.API_URL) throw new Error('API_URL env must be set');
            if (!process.env.PMTILES_URL) throw new Error('PMTILES_URL env must be set');
            if (!process.env.ASSET_BUCKET) throw new Error('ASSET_BUCKET env must be set');

            HookURL = process.env.HookURL;
            API_URL = process.env.API_URL;
            Bucket = process.env.ASSET_BUCKET;
            DynamoDB = process.env.StackName;
            SigningSecret = await Config.fetchSigningSecret(process.env.StackName);
        }

        const pg: Pool<typeof pgtypes> = await Pool.connect(args.postgres, pgtypes, {
            ssl: process.env.StackName === 'test' ? undefined  : { rejectUnauthorized: false },
            migrationsFolder: (new URL('../migrations', import.meta.url)).pathname
        })

        const models = new Models(pg);

        let server: InferSelectModel<typeof Server>;
        try {
            server = await models.Server.from(1);
        } catch (err) {
            console.log(`ok - no server config found: ${err instanceof Error ? err.message : String(err)}`);

            server = await models.Server.generate({
                name: 'Default Server',
                url: 'ssl://ops.example.com:8089',
                api: 'https://ops.example.com:8443'
            });
        }

        const config = new Config({
            unsafe: (args.unsafe || false),
            silent: (args.silent || false),
            local: (args.local || false),
            noevents: (args.noevents || false),
            nometrics: (args.nometrics || false),
            nosinks: (args.nosinks || false),
            nocache: (args.nocache || false),
            TileBaseURL: process.env.TileBaseURL ? new URL(process.env.TileBaseURL) : new URL('./data-dev/zipcodes.tilebase', import.meta.url),
            PMTILES_URL: process.env.PMTILES_URL || 'http://localhost:5001',
            MartiAPI: process.env.MartiAPI,
            AuthGroup: process.env.AuthGroup,
            StackName: process.env.StackName,
            wsClients: new Map(),
            server, SigningSecret, API_URL, DynamoDB, Bucket, pg, models, HookURL
        });

        if (!config.silent) {
            console.error('ok - set env AWS_DEFAULT_REGION: us-east-1');
            console.log(`ok - PMTiles: ${config.PMTILES_URL}`);
            console.error(`ok - StackName: ${config.StackName}`);
        }

        return config;
    }

    /**
     * Return a prefix to an ARN
     */
    async fetchArnPrefix(service = ''): Promise<string> {
        const sts = new STS.STSClient({ region: process.env.AWS_DEFAULT_REGION });
        const account = await sts.send(new STS.GetCallerIdentityCommand({}));
        const res = [];
        res.push(...account.Arn.split(':').splice(0, 2));
        res.push(service);
        res.push(process.env.AWS_DEFAULT_REGION);
        res.push(...account.Arn.split(':').splice(4, 1))
        return res.join(':');
    }

    static async fetchSigningSecret(StackName: string): Promise<string> {
        const secrets = new SecretsManager.SecretsManagerClient({ region: process.env.AWS_DEFAULT_REGION });

        const secret = await secrets.send(new SecretsManager.GetSecretValueCommand({
            SecretId: `${StackName}/api/secret`
        }));

        return secret.SecretString || '';
    }
}

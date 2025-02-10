import Err from '@openaddresses/batch-error';
import STS from '@aws-sdk/client-sts';
import External from './external.js';
import SecretsManager from '@aws-sdk/client-secrets-manager';
import EventsPool from './events-pool.js';
import { Pool, GenerateUpsert } from '@openaddresses/batch-generic';
import ConnectionPool from './connection-pool.js';
import { ConnectionWebSocket } from './connection-web.js';
import Cacher from './cacher.js';
import type { Server } from './schema.js';
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
}

export default class Config {
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
    external?: External;
    UnsafeSigningSecret: string;
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
    events: EventsPool;
    VpcId?: string;
    SubnetPublicA?: string;
    SubnetPublicB?: string;
    MediaSecurityGroup?: string;
    arnPrefix?: string;

    constructor(init: {
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
        DynamoDB?: string;
        Bucket?: string;
        HookURL?: string;
    }) {
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
        this.DynamoDB = init.DynamoDB;
        this.Bucket = init.Bucket;
        this.server = init.server;
        this.HookURL = init.HookURL;

        this.conns = new ConnectionPool(this);
        this.cacher = new Cacher(this.nocache, this.silent);

        this.events = new EventsPool(this.StackName);
    }

    serverCert(): {
        cert: string;
        key: string;
    } {
        if (!this.server.auth.cert) throw new Err(500, null, 'Server auth.cert not set');
        if (!this.server.auth.key) throw new Err(500, null, 'Server auth.key not set');

        return {
            cert: this.server.auth.cert,
            key: this.server.auth.key
        }
    }

    static async env(args: ConfigArgs): Promise<Config> {
        if (!process.env.AWS_REGION) {
            process.env.AWS_REGION = 'us-east-1';
        }

        let SigningSecret, API_URL, PMTILES_URL, DynamoDB, Bucket, HookURL;
        if (!process.env.StackName || process.env.StackName === 'test') {
            process.env.StackName = 'test';

            SigningSecret = 'coe-wildland-fire';
            API_URL = 'http://localhost:5001';
            Bucket = process.env.ASSET_BUCKET;
            PMTILES_URL = process.env.PMTILES_URL || 'http://localhost:5001';
        } else {
            if (!process.env.StackName) throw new Error('StackName env must be set');
            if (!process.env.API_URL) throw new Error('API_URL env must be set');
            if (!process.env.ASSET_BUCKET) throw new Error('ASSET_BUCKET env must be set');

            HookURL = process.env.HookURL;

            const apiUrl = new URL(`http://${process.env.API_URL}`);
            if (apiUrl.hostname === 'localhost') {
                API_URL = `http://${process.env.API_URL}`;
                PMTILES_URL = process.env.PMTILES_URL || 'http://localhost:5001'
            } else {
                PMTILES_URL = process.env.PMTILES_URL || `https://tiles.${process.env.API_URL}`;
                API_URL = String(`https://${process.env.API_URL}`);
            }

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
            noevents: (args.noevents || false),
            nometrics: (args.nometrics || false),
            nosinks: (args.nosinks || false),
            nocache: (args.nocache || false),
            TileBaseURL: process.env.TileBaseURL ? new URL(process.env.TileBaseURL) : new URL('./data-dev/zipcodes.tilebase', import.meta.url),
            StackName: process.env.StackName,
            wsClients: new Map(),
            server, SigningSecret, API_URL, DynamoDB, Bucket, pg, models, HookURL, PMTILES_URL
        });

        if (!config.silent) {
            console.error('ok - set env AWS_REGION: us-east-1');
            console.log(`ok - PMTiles: ${config.PMTILES_URL}`);
            console.error(`ok - StackName: ${config.StackName}`);
        }

        const external = await External.init(config);
        config.external = external;

        if (process.env.VpcId) config.VpcId = process.env.VpcId;
        if (process.env.SubnetPublicA) config.SubnetPublicA = process.env.SubnetPublicA;
        if (process.env.SubnetPublicB) config.SubnetPublicB = process.env.SubnetPublicB;
        if (process.env.MediaSecurityGroup) config.MediaSecurityGroup = process.env.MediaSecurityGroup;

        for (const envkey in process.env) {
            if (!envkey.startsWith('CLOUDTAK')) continue;

            if (envkey.startsWith('CLOUDTAK_Config_')) {
                const key = envkey.replace(/^CLOUDTAK_Config_/, '').replace(/_/g, '::');
                console.error(`ok - Updating ${key} with value from environment`);
                await config.models.Setting.generate({
                    key,
                    value: process.env[envkey]
                },{ upsert: GenerateUpsert.UPDATE })
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
            res.push(...account.Arn.split(':').splice(4, 1))
            this.arnPrefix = res.join(':');

            return this.arnPrefix;
        }
    }

    static async fetchSigningSecret(StackName: string): Promise<string> {
        const secrets = new SecretsManager.SecretsManagerClient({ region: process.env.AWS_REGION });

        const secret = await secrets.send(new SecretsManager.GetSecretValueCommand({
            SecretId: `${StackName}/api/secret`
        }));

        return secret.SecretString || '';
    }
}

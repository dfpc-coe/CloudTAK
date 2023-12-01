import SecretsManager from '@aws-sdk/client-secrets-manager';
import type EventsPool from './events-pool.js';
import ConnectionPool, { ConnectionWebSocket } from './connection-pool.js';
// @ts-ignore
import Server from './types/Server.js';
// @ts-ignore
import { Pool } from '@openaddresses/batch-generic';
import Cacher from './cacher.js';

interface ConfigArgs {
    silent: boolean,
    unsafe: boolean,
    noevents: boolean,
    nosinks: boolean,
    nometrics: boolean,
    local: boolean
}

/**
 * @class
 */
export default class Config {
    local: boolean;
    silent: boolean;
    unsafe: boolean;
    noevents: boolean;
    nometrics: boolean;
    nosinks: boolean;
    StackName: string;
    HookURL?: string;
    SigningSecret: string;
    UnsafeSigningSecret: string;
    MartiAPI: string;
    AuthGroup: string;
    API_URL: string;
    PMTILES_URL: string;
    TileBaseURL: URL;
    DynamoDB: string;
    wsClients: Map<string, ConnectionWebSocket[]>;
    Bucket?: string;
    pool?: Pool;
    cacher?: Cacher;
    conns?: ConnectionPool;
    server?: Server;
    events?: EventsPool;

    static async env(args: ConfigArgs) {
        const config = new Config();

        config.silent = (args.silent || false);
        config.local = (args.local || false);
        config.noevents = (args.noevents || false);
        config.nometrics = (args.nometrics || false);
        config.nosinks = (args.nosinks || false);
        config.wsClients = new Map();

        try {
            if (!process.env.AWS_DEFAULT_REGION) {
                if (!config.silent) console.error('ok - set env AWS_DEFAULT_REGION: us-east-1');
                process.env.AWS_DEFAULT_REGION = 'us-east-1';
            }

            config.UnsafeSigningSecret = 'coe-wildland-fire';
            config.unsafe = args.unsafe;

            config.TileBaseURL = process.env.TileBaseURL ? new URL(process.env.TileBaseURL) : new URL('./data-dev/zipcodes.tilebase', import.meta.url);
            config.PMTILES_URL = process.env.PMTILES_URL || 'http://localhost:5001';
            config.MartiAPI = process.env.MartiAPI;
            config.AuthGroup = process.env.AuthGroup;

            if (!config.silent) console.log(`ok - PMTiles: ${config.PMTILES_URL}`);

            if (!config.MartiAPI) throw new Error('MartiAPI env must be set');
            if (!config.AuthGroup) throw new Error('AuthGroup env must be set');

            if (!process.env.StackName || process.env.StackName === 'test') {
                if (!config.silent) console.error('ok - set env StackName: test');
                process.env.StackName = 'test';

                config.SigningSecret = config.UnsafeSigningSecret;
                config.StackName = 'test';
                config.API_URL = 'http://localhost:5001';
                config.DynamoDB = '';
                config.Bucket = process.env.ASSET_BUCKET;
            } else {
                if (!config.silent) console.error(`ok - StackName: ${config.StackName}`);
                if (config.local) throw new Error('local option cannot be used in production mode - Set StackName=test');
                if (!process.env.StackName) throw new Error('StackName env must be set');
                if (!process.env.API_URL) throw new Error('API_URL env must be set');
                if (!process.env.PMTILES_URL) throw new Error('PMTILES_URL env must be set');
                if (!process.env.ASSET_BUCKET) throw new Error('ASSET_BUCKET env must be set');

                config.HookURL = process.env.HookURL;
                config.StackName = process.env.StackName;
                config.API_URL = process.env.API_URL;
                config.Bucket = process.env.ASSET_BUCKET;

                config.DynamoDB = config.StackName;

                config.SigningSecret = await config.fetchSigningSecret();
            }
        } catch (err) {
            throw new Error(err);
        }

        return config;
    }

    async fetchSigningSecret(): Promise<string> {
        const secrets = new SecretsManager.SecretsManagerClient({ region: process.env.AWS_DEFAULT_REGION });

        const secret = await secrets.send(new SecretsManager.GetSecretValueCommand({
            SecretId: `${this.StackName}/api/secret`
        }));

        return secret.SecretString || '';
    }
}

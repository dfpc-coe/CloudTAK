import SecretsManager from '@aws-sdk/client-secrets-manager';
import type EventsPool from './events-pool.js';

interface ConfigArgs {
    silent: boolean,
    unsafe: boolean,
    noevents: boolean
}

/**
 * @class
 */
export default class Config {
    silent: boolean;
    unsafe: boolean;
    noevents: boolean;
    StackName: string;
    SigningSecret: string;
    UnsafeSigningSecret: string;
    Username: string;
    Password: string;
    API_URL: string;
    PMTILES_URL: string;
    TileBaseURL: URL;
    DynamoDB: string;
    wsClients: any[];
    Bucket?: string;
    pool?: any;
    cacher: any;
    conns: any;
    server: any;
    events?: EventsPool;

    static async env(args: ConfigArgs) {
        const config = new Config();

        config.silent = (args.silent || false);
        config.noevents = (args.noevents || false);

        config.wsClients = []
        config.pool = null;
        config.cacher = null;
        config.conns = null;
        config.server = null;

        try {
            if (!process.env.AWS_DEFAULT_REGION) {
                if (!config.silent) console.error('ok - set env AWS_DEFAULT_REGION: us-east-1');
                process.env.AWS_DEFAULT_REGION = 'us-east-1';
            }

            config.UnsafeSigningSecret = 'coe-wildland-fire';
            config.unsafe = args.unsafe;

            config.TileBaseURL = process.env.TileBaseURL ? new URL(process.env.TileBaseURL) : new URL('./data-dev/zipcodes.tilebase', import.meta.url);
            config.PMTILES_URL = process.env.PMTILES_URL || 'http://localhost:5001';
            if (!config.silent) console.log(`ok - PMTiles: ${config.PMTILES_URL}`);

            if (!process.env.StackName || process.env.StackName === 'test') {
                if (!config.silent) console.error('ok - set env StackName: test');
                process.env.StackName = 'test';

                config.SigningSecret = config.UnsafeSigningSecret;
                config.StackName = 'test';
                config.Username = 'admin';
                config.Password = 'admin';
                config.API_URL = 'http://localhost:5001';
                config.DynamoDB = '';
                config.Bucket = process.env.ASSET_BUCKET;
            } else {
                if (!config.silent) console.error(`ok - StackName: ${config.StackName}`);
                if (!process.env.StackName) throw new Error('StackName env must be set');
                if (!process.env.TAK_USERNAME) throw new Error('TAK_USERNAME env must be set');
                if (!process.env.TAK_PASSWORD) throw new Error('TAK_PASSWORD env must be set');
                if (!process.env.API_URL) throw new Error('API_URL env must be set');
                if (!process.env.PMTILES_URL) throw new Error('PMTILES_URL env must be set');
                if (!process.env.ASSET_BUCKET) throw new Error('ASSET_BUCKET env must be set');

                config.StackName = process.env.StackName;
                config.Username = process.env.TAK_USERNAME;
                config.Password = process.env.TAK_PASSWORD;
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

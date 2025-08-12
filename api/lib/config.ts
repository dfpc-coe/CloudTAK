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
import { type InferSelectModel, sql } from 'drizzle-orm';
import Models from './models.js';
import process from 'node:process';
import * as pgtypes from './schema.js';

interface ConfigArgs {
    silent: boolean,
    postgres: string,
    noevents: boolean,
    nosinks: boolean,
    nocache: boolean,
}

export default class Config {
    silent: boolean;
    noevents: boolean;
    nosinks: boolean;
    nocache: boolean;
    models: Models;
    StackName: string;
    SigningSecret: string;
    MediaSecret: string;
    external?: External;
    API_URL: string;
    PMTILES_URL: string;
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
        noevents: boolean;
        nosinks: boolean;
        nocache: boolean;
        models: Models;
        StackName: string;
        API_URL: string;
        PMTILES_URL: string;
        MediaSecret: string;
        SigningSecret: string;
        wsClients: Map<string, ConnectionWebSocket[]>;
        pg: Pool<typeof pgtypes>;
        server: InferSelectModel<typeof Server>;
        DynamoDB?: string;
        Bucket?: string;
    }) {
        this.silent = init.silent;
        this.noevents = init.noevents;
        this.nosinks = init.nosinks;
        this.nocache = init.nocache;
        this.models = init.models;
        this.StackName = init.StackName;
        this.MediaSecret = init.MediaSecret;
        this.SigningSecret = init.SigningSecret;
        this.API_URL = init.API_URL;
        this.PMTILES_URL = init.PMTILES_URL;
        this.wsClients = init.wsClients;
        this.pg = init.pg;
        this.DynamoDB = init.DynamoDB;
        this.Bucket = init.Bucket;
        this.server = init.server;

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

        let SigningSecret, MediaSecret, API_URL, PMTILES_URL, DynamoDB, Bucket;
        if (!process.env.StackName || process.env.StackName === 'test') {
            process.env.StackName = 'test';

            SigningSecret = process.env.SigningSecret || 'coe-wildland-fire';
            MediaSecret = process.env.MediaSecret || 'coe-wildland-fire-video';
            Bucket = process.env.ASSET_BUCKET;
            API_URL = process.env.API_URL || 'http://localhost:5001';
            PMTILES_URL = process.env.PMTILES_URL || 'http://localhost:5001';
        } else {
            if (!process.env.StackName) throw new Error('StackName env must be set');
            if (!process.env.API_URL) throw new Error('API_URL env must be set');
            if (!process.env.ASSET_BUCKET) throw new Error('ASSET_BUCKET env must be set');

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
            SigningSecret = process.env.SigningSecret || await Config.fetchSecret(process.env.StackName, 'secret');
            MediaSecret = process.env.MediaSecret || await Config.fetchSecret(process.env.StackName, 'media');
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

            // Create server with environment variables if available
            const serverData: Record<string, unknown> = {
                name: process.env.CLOUDTAK_Server_name || 'Default Server',
                url: process.env.CLOUDTAK_Server_url || 'ssl://localhost:8089',
                api: process.env.CLOUDTAK_Server_api || 'https://localhost:8443'
            };
            
            if (process.env.CLOUDTAK_Server_webtak) {
                serverData.webtak = process.env.CLOUDTAK_Server_webtak;
            }
            
            // Handle auth certificates
            if (process.env.CLOUDTAK_Server_auth_p12_secret_arn && process.env.CLOUDTAK_Server_auth_password) {
                try {
                    const secrets = new SecretsManager.SecretsManagerClient({ region: process.env.AWS_REGION });
                    const secretValue = await secrets.send(new SecretsManager.GetSecretValueCommand({
                        SecretId: process.env.CLOUDTAK_Server_auth_p12_secret_arn
                    }));
                    
                    if (secretValue.SecretBinary) {
                        const pem = (await import('pem')).default;
                        const p12Buffer = Buffer.from(secretValue.SecretBinary);
                        
                        const certs = await new Promise<{ pemCertificate: string; pemKey: string }>((resolve, reject) => {
                            pem.readPkcs12(p12Buffer, { p12Password: process.env.CLOUDTAK_Server_auth_password }, (err: Error | null, result: { cert: string; key: string }) => {
                                if (err) {
                                    reject(err);
                                } else {
                                    resolve({ pemCertificate: result.cert, pemKey: result.key });
                                }
                            });
                        });
                        
                        serverData.auth = {
                            cert: certs.pemCertificate,
                            key: certs.pemKey
                        };
                        console.error('ok - Extracted certificate and key from P12 binary secret');
                    }
                } catch (err) {
                    console.error(`Error extracting P12 from binary secret: ${err instanceof Error ? err.message : String(err)}`);
                }
            } else if (process.env.CLOUDTAK_Server_auth_cert && process.env.CLOUDTAK_Server_auth_key) {
                serverData.auth = {
                    cert: process.env.CLOUDTAK_Server_auth_cert,
                    key: process.env.CLOUDTAK_Server_auth_key
                };
            }
            
            server = await models.Server.generate(serverData);
        }
        
        // Update server with environment variables
        console.error(`ok - Initial server state: auth.cert=${!!server.auth?.cert}, auth.key=${!!server.auth?.key}, webtak=${!!server.webtak}`);
        console.error(`ok - Environment variables: CLOUDTAK_Server_name=${process.env.CLOUDTAK_Server_name}, CLOUDTAK_Server_url=${process.env.CLOUDTAK_Server_url}, CLOUDTAK_Server_api=${process.env.CLOUDTAK_Server_api}, CLOUDTAK_Server_webtak=${process.env.CLOUDTAK_Server_webtak}`);
        console.error(`ok - Auth env vars: CLOUDTAK_Server_auth_cert=${!!process.env.CLOUDTAK_Server_auth_cert}, CLOUDTAK_Server_auth_key=${!!process.env.CLOUDTAK_Server_auth_key}, CLOUDTAK_Server_auth_p12=${!!process.env.CLOUDTAK_Server_auth_p12}`);
        console.error(`ok - Admin env vars: CLOUDTAK_ADMIN_USERNAME=${!!process.env.CLOUDTAK_ADMIN_USERNAME}, CLOUDTAK_ADMIN_PASSWORD=${!!process.env.CLOUDTAK_ADMIN_PASSWORD}`);
        
        // Debug all CLOUDTAK environment variables
        const cloudtakEnvs = Object.keys(process.env).filter(key => key.startsWith('CLOUDTAK_')).sort();
        console.error(`ok - All CLOUDTAK env vars: ${cloudtakEnvs.join(', ')}`);
        
        if (process.env.CLOUDTAK_Server_auth_p12) {
            console.error(`ok - P12 content length: ${process.env.CLOUDTAK_Server_auth_p12.length}`);
            console.error(`ok - P12 starts with: ${process.env.CLOUDTAK_Server_auth_p12.substring(0, 50)}...`);
        } else {
            console.error('ok - CLOUDTAK_Server_auth_p12 is undefined/empty');
        }
        
        if (process.env.CLOUDTAK_Server_auth_cert) {
            console.error(`ok - Direct cert length: ${process.env.CLOUDTAK_Server_auth_cert.length}`);
        }
        
        if (process.env.CLOUDTAK_Server_auth_key) {
            console.error(`ok - Direct key length: ${process.env.CLOUDTAK_Server_auth_key.length}`);
        }
        
        const serverEnvUpdates: Record<string, unknown> = {};
        let hasServerUpdates = false;

        if (process.env.CLOUDTAK_Server_name) {
            serverEnvUpdates.name = process.env.CLOUDTAK_Server_name;
            hasServerUpdates = true;
        }
        if (process.env.CLOUDTAK_Server_url) {
            serverEnvUpdates.url = process.env.CLOUDTAK_Server_url;
            hasServerUpdates = true;
        }
        if (process.env.CLOUDTAK_Server_api) {
            serverEnvUpdates.api = process.env.CLOUDTAK_Server_api;
            hasServerUpdates = true;
        }
        if (process.env.CLOUDTAK_Server_webtak) {
            serverEnvUpdates.webtak = process.env.CLOUDTAK_Server_webtak;
            hasServerUpdates = true;
        }
        
        // Handle auth certificates for existing server
        console.error('ok - Updating server configuration from environment variables');
        
        if (process.env.CLOUDTAK_Server_auth_p12_secret_arn && process.env.CLOUDTAK_Server_auth_password) {
            console.error('ok - Processing P12 certificate from binary secret');
            try {
                const secrets = new SecretsManager.SecretsManagerClient({ region: process.env.AWS_REGION });
                const secretValue = await secrets.send(new SecretsManager.GetSecretValueCommand({
                    SecretId: process.env.CLOUDTAK_Server_auth_p12_secret_arn
                }));
                
                if (secretValue.SecretBinary) {
                    const pem = (await import('pem')).default;
                    const p12Buffer = Buffer.from(secretValue.SecretBinary);
                    
                    const certs = await new Promise<{ pemCertificate: string; pemKey: string }>((resolve, reject) => {
                        pem.readPkcs12(p12Buffer, { p12Password: process.env.CLOUDTAK_Server_auth_password }, (err: Error | null, result: { cert: string; key: string }) => {
                            if (err) {
                                reject(err);
                            } else {
                                resolve({ pemCertificate: result.cert, pemKey: result.key });
                            }
                        });
                    });
                    
                    if (certs.pemCertificate && certs.pemKey) {
                        serverEnvUpdates.auth = {
                            ...(server.auth || {}),
                            cert: certs.pemCertificate,
                            key: certs.pemKey
                        };
                        hasServerUpdates = true;
                        console.error('ok - Successfully extracted certificate and key from P12 binary secret');
                    } else {
                        console.error('ok - P12 conversion failed: missing certificate or key');
                    }
                } else {
                    console.error('ok - No SecretBinary found in secret');
                }
            } catch (err) {
                console.error(`ok - Error processing P12 binary secret: ${err instanceof Error ? err.message : String(err)}`);
            }
        } else if (process.env.CLOUDTAK_Server_auth_cert && process.env.CLOUDTAK_Server_auth_key) {
            console.error('ok - Using direct certificate and key from environment variables');
            serverEnvUpdates.auth = {
                ...(server.auth || {}),
                cert: process.env.CLOUDTAK_Server_auth_cert,
                key: process.env.CLOUDTAK_Server_auth_key
            };
            hasServerUpdates = true;
            console.error(`ok - Direct auth configured: cert=${process.env.CLOUDTAK_Server_auth_cert.length} chars, key=${process.env.CLOUDTAK_Server_auth_key.length} chars`);
        } else {
            console.error('ok - No certificate environment variables found - server will run without client certificates');
        }
        
        if (hasServerUpdates) {
            console.error(`ok - Updates to apply: ${JSON.stringify(Object.keys(serverEnvUpdates))}`);
            server = await models.Server.commit(server.id, {
                ...serverEnvUpdates,
                updated: sql`Now()`
            });
            console.error(`ok - Server updated: auth.cert=${!!server.auth?.cert}, auth.key=${!!server.auth?.key}, webtak=${!!server.webtak}`);
        } else {
            console.error('ok - No server updates needed from environment variables');
        }

        console.error(`ok - Final server state before Config creation: auth.cert=${!!server.auth?.cert}, auth.key=${!!server.auth?.key}, webtak=${!!server.webtak}`);
        
        const config = new Config({
            silent: (args.silent || false),
            noevents: (args.noevents || false),
            nosinks: (args.nosinks || false),
            nocache: (args.nocache || false),
            StackName: process.env.StackName,
            wsClients: new Map(),
            server, SigningSecret, MediaSecret, API_URL, DynamoDB, Bucket, pg, models, PMTILES_URL
        });
        
        console.error(`ok - Config created with server: auth.cert=${!!config.server.auth?.cert}, auth.key=${!!config.server.auth?.key}, webtak=${!!config.server.webtak}`);

        if (!config.silent) {
            console.error(`ok - set env AWS_REGION: ${process.env.AWS_REGION}`);
            console.log(`ok - PMTiles: ${config.PMTILES_URL}`);
            console.error(`ok - StackName: ${config.StackName}`);
        }

        const external = await External.init(config);
        config.external = external;

        if (process.env.VpcId) config.VpcId = process.env.VpcId;
        if (process.env.SubnetPublicA) config.SubnetPublicA = process.env.SubnetPublicA;
        if (process.env.SubnetPublicB) config.SubnetPublicB = process.env.SubnetPublicB;
        if (process.env.MediaSecurityGroup) config.MediaSecurityGroup = process.env.MediaSecurityGroup;

        // Ensure admin user has admin permissions if credentials provided
        if (process.env.CLOUDTAK_ADMIN_USERNAME && process.env.CLOUDTAK_ADMIN_PASSWORD) {
            try {
                console.error('ok - Ensuring admin user has admin permissions');
                
                // Create admin user directly in database with admin permissions
                await config.models.Profile.generate({
                    username: process.env.CLOUDTAK_ADMIN_USERNAME,
                    auth: { password: process.env.CLOUDTAK_ADMIN_PASSWORD },
                    system_admin: true
                }, { upsert: GenerateUpsert.UPDATE });
                
                console.error('ok - Admin user ensured with admin permissions');
            } catch (err) {
                console.error(`Error ensuring admin user: ${err instanceof Error ? err.message : String(err)}`);
            }
        }

        for (const envkey in process.env) {
            if (!envkey.startsWith('CLOUDTAK')) continue;

            // TODO Strongly type via the Type in routes/config
            if (envkey.startsWith('CLOUDTAK_Config_')) {
                const key = envkey.replace(/^CLOUDTAK_Config_/, '').replace(/_/g, '::');
                console.error(`ok - Updating ${key} with value from environment`);
                await config.models.Setting.generate({
                    key,
                    value: process.env[envkey]
                },{
                    upsert: GenerateUpsert.UPDATE
                })
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

    static async fetchSecret(
        StackName: string,
        Secret: string
    ): Promise<string> {
        const secrets = new SecretsManager.SecretsManagerClient({ region: process.env.AWS_REGION });

        const secret = await secrets.send(new SecretsManager.GetSecretValueCommand({
            SecretId: `${StackName}/api/${Secret}`
        }));

        return secret.SecretString || '';
    }
}

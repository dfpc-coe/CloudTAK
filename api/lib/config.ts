import AWS from 'aws-sdk';

interface ConfigArgs {
    silent: boolean
}

/**
 * @class
 */
export default class Config {
    silent: boolean;
    StackName: string;
    SigningSecret: string;
    Username: string;
    Password: string;
    API_URL: string;
    DynamoDB: string;
    wsClients: any[];
    pool: any;
    cacher: any;
    conns: any;
    server: any;

    static async env(args: ConfigArgs) {
        const config = new Config();

        config.silent = (args.silent || false);

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

            if (!process.env.StackName || process.env.StackName === 'test') {
                if (!config.silent) console.error('ok - set env StackName: test');
                process.env.StackName = 'test';

                config.StackName = 'test';
                config.SigningSecret = 'coe-wildland-fire';
                config.Username = 'admin';
                config.Password = 'admin';
                config.API_URL = 'http://localhost:5001';
                config.DynamoDB = '';
            } else {
                if (!process.env.StackName) throw new Error('StackName env must be set');
                if (!process.env.TAK_USERNAME) throw new Error('TAK_USERNAME env must be set');
                if (!process.env.TAK_PASSWORD) throw new Error('TAK_PASSWORD env must be set');
                if (!process.env.API_URL) throw new Error('API_URL env must be set');

                config.StackName = process.env.StackName;
                config.Username = process.env.TAK_USERNAME;
                config.Password = process.env.TAK_PASSWORD;
                config.API_URL = process.env.API_URL;

                config.DynamoDB = config.StackName;

                config.SigningSecret = await config.fetchSigningSecret();
            }
        } catch (err) {
            throw new Error(err);
        }

        return config;
    }

    async fetchSigningSecret(): Promise<string> {
        const secrets = new AWS.SecretsManager({ region: process.env.AWS_DEFAULT_REGION });

        const secret = await secrets.getSecretValue({
            SecretId: `${this.StackName}/api/secret`
        }).promise();

        return secret.SecretString || '';
    }
}

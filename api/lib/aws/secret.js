import AWS from 'aws-sdk';
import Err from '@openaddresses/batch-error';

/**
 * @class
 */
export default class Secret {
    constructor(stack) {
        this.stack = stack;
    }

    async create(source, secrets) {
        const sm = new AWS.SecretsManager({ region: process.env.AWS_DEFAULT_REGION });

        try {
            await sm.createSecret({
                Name: `${this.stack}-source-${source.id}`,
                Description: `${this.stack} Source: ${source.id}`,
                SecretString: JSON.stringify(secrets)
            }).promise();
        } catch (err) {
            throw new Err(500, new Error(err), 'Failed to create secret');
        }
    }

    async from(source) {
        const sm = new AWS.SecretsManager({ region: process.env.AWS_DEFAULT_REGION });

        try {
            const res = await sm.getSecretValue({
                SecretId: `${this.stack}-source-${source.id}`,
            }).promise();

            return JSON.parse(res.SecretString);
        } catch (err) {
            throw new Err(500, new Error(err), 'Failed to retrieve secret');
        }
    }

    async update(source, secrets) {
        const sm = new AWS.SecretsManager({ region: process.env.AWS_DEFAULT_REGION });

        try {
            await sm.putSecretValue({
                SecretId: `${this.stack}-source-${source.id}`,
                SecretString: JSON.stringify(secrets)
            }).promise();
        } catch (err) {
            throw new Err(500, new Error(err), 'Failed to update secret');
        }
    }

    async delete(source) {
        const sm = new AWS.SecretsManager({ region: process.env.AWS_DEFAULT_REGION });

        try {
            await sm.deleteSecret({
                SecretId: `${this.stack}-source-${source.id}`
            }).promise();
        } catch (err) {
            throw new Err(500, new Error(err), 'Failed to delete secret');
        }
    }
}

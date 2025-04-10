import SQS from '@aws-sdk/client-sqs';
import Err from '@openaddresses/batch-error';
import process from 'node:process';

/**
 * @class
 */
export default class HookQueue {
    sqs: SQS.SQSClient;

    constructor() {
        this.sqs = new SQS.SQSClient({ region: process.env.AWS_REGION });
    }

    async submit(
        Entries: SQS.SendMessageBatchRequestEntry[],
        QueueUrl: string
    ): Promise<SQS.SendMessageBatchCommandOutput> {
        try {
            const res = await this.sqs.send(new SQS.SendMessageBatchCommand({ QueueUrl, Entries }));

            return res;
        } catch (err) {
            console.error(err);
            throw new Err(500, new Error(err instanceof Error ? err.message : String(err)), 'Failed to submit SQS Message');
        }
    }
}

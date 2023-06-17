import SQS from '@aws-sdk/client-sqs';
import Err from '@openaddresses/batch-error';
import { XML as COT } from '@tak-ps/node-cot';

/**
 * @class
 */
export default class HookQueue {
    static async submit(connectionid: number, cot: COT) {
        const sqs = new SQS.SQSClient({ region: process.env.AWS_DEFAULT_REGION });

        try {
            const res = await sqs.send(new SQS.SendMessageCommand({
                QueueUrl: process.env.HookURL,
                MessageBody: JSON.stringify(cot),
                MessageGroupId: connectionid
            }));

            return res;
        } catch (err) {
            throw new Err(500, new Error(err), 'Failed to submit SQS Message');
        }
    }
}

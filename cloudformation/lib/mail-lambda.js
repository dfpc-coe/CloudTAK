/* eslint-disable n/no-missing-import -- provided by the Lambda runtime */
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
/* eslint-enable n/no-missing-import */

const ssm = new SSMClient({});
const lambda = new LambdaClient({});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// Layers are addressed as <layer uuid>@<mail domain> and register their
// function ARN as an SSM Parameter under LAYER_PREFIX
async function deliver(uuid, mail, receipt) {
    let arn;
    try {
        const res = await ssm.send(new GetParameterCommand({
            Name: `${process.env.LAYER_PREFIX}${uuid}`
        }));
        arn = res.Parameter.Value;
    } catch (err) {
        if (err.name !== 'ParameterNotFound') throw err;
        console.log(`ok - no layer registered for ${uuid}`);
        return;
    }

    await lambda.send(new InvokeCommand({
        FunctionName: arn,
        InvocationType: 'Event',
        Payload: Buffer.from(JSON.stringify({
            type: 'email',
            bucket: process.env.MAIL_BUCKET,
            key: mail.messageId,
            mail,
            receipt
        }))
    }));

    console.log(`ok - delivered ${mail.messageId} to ${uuid}`);
}

export const handler = async (event) => {
    const deliveries = [];

    for (const record of event.Records || []) {
        const { mail, receipt } = record.ses;

        const layers = new Set();
        for (const recipient of receipt.recipients || []) {
            const address = String(recipient).toLowerCase();
            const at = address.lastIndexOf('@');
            const local = address.slice(0, at);
            const domain = address.slice(at + 1);

            if (domain === process.env.MAIL_DOMAIN.toLowerCase() && UUID.test(local)) {
                layers.add(local);
            }
        }

        for (const uuid of layers) deliveries.push(deliver(uuid, mail, receipt));
    }

    const failed = (await Promise.allSettled(deliveries)).filter((d) => d.status === 'rejected');
    for (const failure of failed) console.error(failure.reason);
    if (failed.length) throw new Error(`${failed.length} deliveries failed`);
};

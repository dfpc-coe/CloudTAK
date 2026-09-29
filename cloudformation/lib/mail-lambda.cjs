// CommonJS as inline Lambda code is deployed as index.js without a package.json
/* eslint-disable n/no-missing-require -- provided by the Lambda runtime */
const { SSMClient, GetParameterCommand } = require('@aws-sdk/client-ssm');
const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');
/* eslint-enable n/no-missing-require */

const ssm = new SSMClient({});
const lambda = new LambdaClient({});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// Senders are an address or an @domain, matched against the From header
function allowed(senders, mail) {
    if (!senders.length) return true;

    const from = (mail.commonHeaders && mail.commonHeaders.from) || [];

    return from.some((entry) => {
        const match = String(entry).match(/<([^<>]+)>\s*$/);
        const address = (match ? match[1] : String(entry)).trim().toLowerCase();

        return senders.some((sender) => {
            sender = sender.toLowerCase();
            return sender.startsWith('@') ? address.endsWith(sender) : address === sender;
        });
    });
}

// Layers are addressed as <layer uuid>@<mail domain> and register their
// function ARN & allowed senders as an SSM Parameter under LAYER_PREFIX
async function deliver(uuid, mail, receipt) {
    let layer;
    try {
        const res = await ssm.send(new GetParameterCommand({
            Name: `${process.env.LAYER_PREFIX}${uuid}`
        }));
        layer = JSON.parse(res.Parameter.Value);
    } catch (err) {
        if (err.name !== 'ParameterNotFound') throw err;
        console.log(`ok - no layer registered for ${uuid}`);
        return;
    }

    if (!allowed(layer.senders || [], mail)) {
        console.log(`ok - sender of ${mail.messageId} not allowed for ${uuid}`);
        return;
    }

    await lambda.send(new InvokeCommand({
        FunctionName: layer.arn,
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

exports.handler = async (event) => {
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

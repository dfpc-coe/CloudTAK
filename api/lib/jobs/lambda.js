/* global console, Buffer, process */
import AWSLambda from '@aws-sdk/client-lambda';
import { workerData } from 'node:worker_threads';

try {
    const lambda = new AWSLambda.LambdaClient({ region: process.env.AWS_REGION });
    const FunctionName = `${workerData.StackName}-layer-${workerData.LayerID}`;

    await lambda.send(new AWSLambda.InvokeCommand({
        FunctionName,
        InvocationType: 'Event',
        Payload: Buffer.from(JSON.stringify({
            type: 'default'
        }))
    }));
} catch (err) {
    console.error(err);
    throw err;
}

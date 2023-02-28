import Lambda from '@aws-sdk/client-lambda';
import { workerData } from 'node:worker_threads';

try {
    console.error(workerData);

    const lambda = new AWSLambda.LambdaClient({ region: process.env.AWS_DEFAULT_REGION });
    const FunctionName = `${workerData.StackName}-layer-${workerData.LayerID}`;

    const res = await lambda.send(new AWSLambda.InvokeCommand({
        FunctionName,
        InvocationType: 'RequestResponse',
        Payload: Buffer.from(JSON.stringify({
            type
        }))
    }));

    console.error(res);
} catch (err) {
    console.error(err);
    throw err;
}

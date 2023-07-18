import Lambda from "aws-lambda";
import ArcGIS from './adaptors/arcgis.js';
import CW from '@aws-sdk/client-cloudwatch';

export async function handler(
    event: Lambda.SQSEvent
): Promise<boolean> {
    for (const record of event.Records) {
        try {
            const req = JSON.parse(record.body);

            if (req.type === 'ArcGIS') {
                await ArcGIS(req);
            } else {
                throw new Error('Unknown Event Type');
            }
        } catch (err) {
            cw
        }
    }

    if (process.env.StackName) {
        const cw = new CW.CloudwatchClient();
        cw.send(new CW.PutMetricDataCommand({
            Namespace: 'TAKETL',

        }));
    }

    return true;
}

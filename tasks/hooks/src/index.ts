import Lambda from "aws-lambda";
import ArcGIS from './adaptors/arcgis.js';
import CW from '@aws-sdk/client-cloudwatch';

type Meta = {
    Timestamp: Date;
    Error?: Error;
}

export async function handler(
    event: Lambda.SQSEvent
): Promise<boolean> {
    const meta: Map<string, Meta> = new Map();

    for (const record of event.Records) {
        try {
            const req = JSON.parse(record.body);

            if (req.type === 'ArcGIS') {
                meta.set(record.messageId, {
                    Timestamp: new Date()
                });
                await ArcGIS(req);
            } else {
                throw new Error('Unknown Event Type');
            }

        } catch (err) {
            const m = meta.get(record.messageId);
            if (m) m.Error = new Error(String(err));
        }
    }

    if (process.env.StackName) {
        const cw = new CW.CloudWatchClient({});
        await cw.send(new CW.PutMetricDataCommand({
            Namespace: 'TAKETL',
            MetricData: event.Records.map((record: Lambda.SQSRecord) => {
                const m = meta.get(record.messageId);
                if (!m) throw new Error('Indeterminant Meta');

                const MetricName = m.Error ? 'ConnectionSinkFailure' : 'ConnectionSinkSuccess';

                return {
                    MetricName,
                    Value: 1,
                    Timestamp: m.Timestamp,
                    Dimensions: [{
                        Name: 'StackName',
                        Value: process.env.StackName
                    },{
                        Name: 'ConnectionSinkId',
                        Value: JSON.parse(record.body).id
                    }],
                }
            })
        }));
    }

    return true;
}

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

    const pool: Array<Promise<unknown>> = [];

    for (const record of event.Records) {
        pool.push(
            (async (record: Lambda.SQSRecord) => {
                try {
                    const req = JSON.parse(record.body);

                    meta.set(record.messageId, { Timestamp: new Date() });
                    if (req.type === 'ArcGIS') {
                        console.log('ArcGIS:', req.feat.properties.callsign);

                        await ArcGIS(req);
                    } else {
                        throw new Error('Unknown Event Type');
                    }

                } catch (err) {
                    console.error(err, 'Record:', record.body);
                    const m = meta.get(record.messageId);
                    if (m) m.Error = new Error(String(err));
                }
            })(record)
        )
    }

    await Promise.allSettled(pool);

    if (process.env.StackName) {
        const MetricData = event.Records.filter((record: Lambda.SQSRecord) => {
            const body: any = JSON.parse(record.body)
            if (!body.options) body.options = {};
            return !!body.options.logging;
        }).filter((record: Lambda.SQSRecord) => {
            const m = meta.get(record.messageId);
            if (!m) throw new Error('Indeterminant Meta');
            return m.Error
        }).map((record: Lambda.SQSRecord) => {
            const m = meta.get(record.messageId);
            if (!m) throw new Error('Indeterminant Meta');

            return {
                MetricName: 'ConnectionSinkFailure',
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
        });

        if (MetricData.length) {
            const cw = new CW.CloudWatchClient({});
            await cw.send(new CW.PutMetricDataCommand({
                Namespace: 'TAKETL',
                MetricData
            }));
        }
    }

    return true;
}

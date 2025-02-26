import ArcGIS from './adaptors/arcgis.js';
import * as Lambda from "aws-lambda";

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
                        console.log(`ArcGIS: ${req.id}, ${req.feat.properties.callsign}`);
                        await ArcGIS(req);
                    } else {
                        throw new Error(`Unknown Event Type: ${req.type}`);
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

    return true;
}

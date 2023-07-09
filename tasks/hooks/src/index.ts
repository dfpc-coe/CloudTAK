import Lambda from "aws-lambda";
import ArcGIS from './adaptors/arcgis.js';

export async function handler(
    event: Lambda.SQSEvent
): Promise<boolean> {
    for (const record of event.Records) {
        const req = JSON.parse(record.body);

        if (req.type === 'ArcGIS') {
            await ArcGIS(req);
        } else {
            throw new Error('Unknown Event Type');
        }
    }

    return true;
}

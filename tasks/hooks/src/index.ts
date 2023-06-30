import Lambda from "aws-lambda";
import { geojsonToArcGIS } from '@terraformer/arcgis'

export async function handler(
    event: Lambda.SQSEvent
): Promise<boolean> {
    for (const record of event.Records) {
        const req = JSON.parse(record.body);

        if (req.type === 'ArcGIS') {
            await arcgis(req);
        } else {
            throw new Error('Unknown Event Type');
        }
    }

    return true;
}

async function arcgis(data: any): Promise<boolean> {
    if (data.feat.geometry.type !== 'Point') return false;

    const geometry = geojsonToArcGIS(data.feat.geometry);

    console.error(data, geometry)

    const res = await fetch(data.body.layer + '/addFeatures', {
        method: 'POST',
        headers: {
            'Referer': data.secrets.referer,
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-Esri-Authorization': `Bearer ${data.secrets.token}`
        },
        body: new URLSearchParams({
            'f': 'json',
            'features': JSON.stringify([{
                attributes: {
                    CallSign: data.feat.properties.callsign,
                    Type: data.feat.properties.type,
                    How: data.feat.properties.how,
                    Time: data.feat.properties.time,
                    Start: data.feat.properties.start,
                    Stale: data.feat.properties.stale
                },
                geometry
            }])
        })
    });

    if (!res.ok) throw new Error(await res.text());

    console.error(await res.text());

    return true;
}

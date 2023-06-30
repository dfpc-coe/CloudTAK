import Lambda from "aws-lambda";
import jwt from 'jsonwebtoken';
import { arcgisToGeoJSON, geojsonToArcGIS } from '@terraformer/arcgis'

export async function handler(
    event: Lambda.SQSEvent,
    context: Lambda.Context,
): Promise<boolean> {
    for (const record of event.Records) {
        const req = JSON.parse(record.body);

        if (req.type === 'ArcGIS') {
            await arcgis(req);
        } else {
            throw new Error('Unknown Event Type');
        }
    }
};

async function arcgis(data: any) {
    if (data.feat.geometry.type !== 'Point') return;

    const geometry = geojsonToArcGIS(data.feat.geometry);

    console.error(data, geometry)

    await fetch(data.layer + '/addFeatures', {
        method: 'POST',
        headers: {
            'Referer': data.secrets.referer,
            'Content-Type': 'application/json',
            'X-Esri-Authorization': `Bearer ${data.secrets.token}`
        },
        body: JSON.stringify([{
            attributes: {
                CallSign: data.feat.properties.callsign
            },
            geometry
        }])
    });

    if (!res.ok) throw new Error(await res.text());
}

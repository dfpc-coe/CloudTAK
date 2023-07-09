import Lambda from "aws-lambda";
import { geojsonToArcGIS } from '@terraformer/arcgis'

export default async function arcgis(data: any): Promise<boolean> {
    if (data.feat.geometry.type !== 'Point') return false;

    const res_query = await fetch(data.body.layer + '/query', {
        method: 'POST',
        headers: {
            'Referer': data.secrets.referer,
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-Esri-Authorization': `Bearer ${data.secrets.token}`
        },
        body: new URLSearchParams({
            'f': 'json',
            'where': `uid='${data.feat.id}'`
        })
    });

    if (!res_query.ok) throw new Error(await res_query.text());
    const query = await res_query.json();

    if (!query.features.length) {
        const geometry = geojsonToArcGIS(data.feat.geometry);
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
                        uid: data.feat.id,
                        callsign: data.feat.properties.callsign,
                        type: data.feat.properties.type,
                        how: data.feat.properties.how,
                        time: data.feat.properties.time,
                        start: data.feat.properties.start,
                        stale: data.feat.properties.stale
                    },
                    geometry
                }])
            })
        });

        if (!res.ok) throw new Error(await res.text());
        console.error(await res.text());

        return true;
    } else {
        console.error('UNIMPLEMENTED - UPDATE!!');
        return true;
    }
}

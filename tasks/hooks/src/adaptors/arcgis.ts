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
            'where': `cotuid='${data.feat.id}'`,
            'outFields': '*'
        })
    });

    if (!res_query.ok) throw new Error(await res_query.text());
    const query = await res_query.json();

    if (query.error) throw new Error(query.error.message);

    const geometry = geojsonToArcGIS(data.feat.geometry);

    if (!query.features.length) {
        const res = await fetch(new URL(data.body.layer + '/addFeatures'), {
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
                        cotuid: data.feat.id,
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

        const body = await res.json();

        if (body.error) throw new Error(body.error.message);

        console.error(JSON.stringify(body));

        return true;
    } else {
        const oid = query.features[0].attributes.objectid;

        const res = await fetch(new URL(data.body.layer + '/updateFeatures'), {
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
                        objectid: oid,
                        cotuid: data.feat.id,
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

        const body = await res.json();

        if (body.error) throw new Error(body.error.message);

        return true;
    }
}

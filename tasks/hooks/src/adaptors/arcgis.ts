import { Point } from 'arcgis-rest-api';
import { geojsonToArcGIS } from '@terraformer/arcgis'
import proj4 from 'proj4';

export default async function arcgis(data: any): Promise<boolean> {
    if (data.feat.geometry.type !== 'Point') {
        console.error(`ok - skipping ${data.feat.properties.callsign} due to geometry: ${data.feat.geometry.type}`);
        return false;
    }

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

    if (process.env.DEBUG) console.error('/query', data.feat.properties.callsign, 'Res:', JSON.stringify(query));

    if (query.error) throw new Error(query.error.message);

    let geometry = geojsonToArcGIS(data.feat.geometry) as Point;
    if (!geometry.x || !geometry.y) throw new Error('Incompatible Geometry');

    const proj = proj4('EPSG:4326', 'EPSG:3857', [ geometry.x, geometry.y ]);

    geometry = {
        x: proj[0],
        y: proj[1],
        spatialReference: {
            wkid: 102100,
            latestWkid: 3857
        }
    }

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
                        callsign: data.feat.properties.callsign || 'Unknown',
                        remarks: data.feat.properties.remarks || '',
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

        if (process.env.DEBUG) console.error('/addFeatures', data.feat.properties.callsign, 'Res:', JSON.stringify(body));

        if (body.addResults[0].error) throw new Error(JSON.stringify(body.addResults[0].error));

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

        if (process.env.DEBUG) console.error('/updateFeatures', data.feat.properties.callsign, 'Res:', JSON.stringify(body));

        if (body.updateResults[0].error) throw new Error(JSON.stringify(body.updateResults[0].error));

        return true;
    }
}

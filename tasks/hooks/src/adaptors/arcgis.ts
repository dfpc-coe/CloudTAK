import { Geometry, Point, Polyline, Polygon } from 'arcgis-rest-api';
import { geojsonToArcGIS } from '@terraformer/arcgis'
import proj4 from 'proj4';

export default async function arcgis(data: any): Promise<boolean> {
    let layer;
    if (data.body.points && data.feat.geometry.type === 'Point') {
         layer = data.body.points
    } else if (data.body.lines && data.feat.geometry.type === 'LineString') {
        layer = data.body.lines
    } else if (data.body.polys && data.feat.geometry.type === 'Polygon') {
        layer = data.body.polys;
    } else {
        console.error(`ok - skipping ${data.feat.properties.callsign} due to geometry: ${data.feat.geometry.type}`);
        return false;
    }

    const res_query = await fetch(layer + '/query', {
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

    let geometry: Geometry;
    if (data.feat.geometry.type === 'Point') {
        const geom = geojsonToArcGIS(data.feat.geometry) as Point;
        if (!geom.x || !geom.y) throw new Error('Incompatible Geometry');

        const proj = proj4('EPSG:4326', 'EPSG:3857', [ geom.x, geom.y ]);

        geom.x = proj[0];
        geom.y = proj[1];

        geometry = geom;
    } else if (data.feat.geometry.type === 'LineString') {
        const geom = geojsonToArcGIS(data.feat.geometry) as Polyline;

        geom.paths = geom.paths.map((paths) => {
            return paths.map((p) => {
                return proj4('EPSG:4326', 'EPSG:3857', p);
            })
        })

        geometry = geom;
    } else if (data.feat.geometry.type === 'Polygon') {
        const geom = geojsonToArcGIS(data.feat.geometry) as Polygon;

        geom.rings = geom.rings.map((ring) => {
            return ring.map((r) => {
                return proj4('EPSG:4326', 'EPSG:3857', r);
            })
        })

        geometry = geom;
    } else {
        throw new Error(`Incompatible Geometry: ${data.feat.geometry.type}`);
    }

    geometry.spatialReference = {
        wkid: 102100,
        latestWkid: 3857
    }

    if (!query.features.length) {
        const res = await fetch(new URL(layer + '/addFeatures'), {
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

        if (body.addResults.length && body.addResults[0].error) throw new Error(JSON.stringify(body.addResults[0].error));

        return true;
    } else {
        const oid = query.features[0].attributes.objectid;

        const res = await fetch(new URL(layer + '/updateFeatures'), {
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

        if (body.updateResults.length && body.updateResults[0].error) throw new Error(JSON.stringify(body.updateResults[0].error));

        return true;
    }
}

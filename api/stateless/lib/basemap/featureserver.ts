import Err from '@openaddresses/batch-error';
import { fetch as typedFetch } from '@tak-ps/node-safeurl';
import { Feature } from '@tak-ps/node-cot';
import { Static } from '@sinclair/typebox';
import { Basemap_FeatureAction } from '../../../common/enums.js';
import { MultiGeoJSONFeatureCollection, MultiGeoJSONFeature } from '../../../common/types.js';
import { EsriPolygon } from '../esri/types.js';
import { esriToGeoJSON, parseFeatureSet } from '../esri/geojson.js';
import { BasemapProtocol, TileJSONActions } from '../interface-basemap.js';

/**
 * @class
 *
 * ESRI FeatureServer basemap protocol - supports polygon querying and
 * single-feature fetching against an ArcGIS FeatureServer endpoint.
 */
export default class FeatureServerBasemap extends BasemapProtocol {
    isValidURL(str: string): void {
        super.isValidURL(str);

        if (!str.match(/\/FeatureServer\/\d+$/)) {
            throw new Err(400, null, 'FeatureServer protocol requires a URL ending with /FeatureServer/{id}');
        }
    }

    actions(): Static<typeof TileJSONActions> {
        return {
            feature: [
                Basemap_FeatureAction.FETCH,
                Basemap_FeatureAction.QUERY,
            ],
        };
    }

    /**
     * Query features within a polygon from the FeatureServer.
     *
     * @param polygon - GeoJSON Polygon to query within
     */
    async featureQuery(
        polygon: Static<typeof Feature.Polygon>,
    ): Promise<Static<typeof MultiGeoJSONFeatureCollection>> {
        const url = this.basemap!.url;

        const esriPolygon: Static<typeof EsriPolygon> = {
            rings: polygon.coordinates,
            spatialReference: { wkid: 4326, latestWkid: 4326 },
        };

        const urlBuilder = new URL(url + '/query');
        const formData = new FormData();
        formData.append('where', '1=1');
        formData.append('outFields', '*');
        formData.append('f', 'json');
        formData.append('outSR', '4326');
        formData.append('geometryType', 'esriGeometryPolygon');
        formData.append('spatialRel', 'esriSpatialRelIntersects');
        formData.append('geometry', JSON.stringify(esriPolygon));

        const res = await fetch(urlBuilder, {
            method: 'POST',
            body: formData,
        });

        if (!res.ok) throw new Err(400, null, `Upstream Error: ${await res.text()}`);

        return esriToGeoJSON(parseFeatureSet(await res.json()));
    }

    /**
     * Fetch a single feature by objectId from the FeatureServer.
     *
     * @param id - Feature objectId
     */
    async featureFetch(
        id: string,
    ): Promise<Static<typeof MultiGeoJSONFeature>> {
        const urlBuilder = new URL(this.basemap!.url + '/query');
        urlBuilder.searchParams.set('f', 'json');
        urlBuilder.searchParams.set('outSR', '4326');
        urlBuilder.searchParams.set('objectIds', String(id));
        urlBuilder.searchParams.set('outFields', '*');

        const res = await typedFetch(urlBuilder);

        if (!res.ok) throw new Err(400, null, `Upstream Error: ${await res.text()}`);

        const fc = esriToGeoJSON(parseFeatureSet(await res.json()));

        if (fc.features.length === 0) {
            throw new Err(404, null, `Could not find feature with ID: ${id}`);
        } else if (fc.features.length > 1) {
            throw new Err(404, null, `Server returned multiple features with ID: ${id}`);
        }

        const feat = fc.features[0];
        feat.id = id;
        return feat;
    }
}

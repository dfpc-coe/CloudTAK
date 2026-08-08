import type { BBox, Polygon } from 'geojson';
import type { F, KmlOptions } from '../types.ts';
import { type P, getMulti, num1 } from '../shared.ts';
import { type XmlNode, get1, getAttribute } from '../xml.ts';
import { extractIconHref, extractStyle } from './extractStyle.ts';
import {
    type Schema,
    type StyleMap,
    extractCascadedStyle,
    extractExtendedData,
    extractTimeSpan,
    extractTimeStamp,
    getMaybeHTMLDescription,
    processAltitudeMode,
} from './shared.ts';

type Lod = Array<number | null>;

interface CoordinateBox {
    bbox?: BBox;
    geometry: Polygon;
}

function getNetworkLinkRegion(node: XmlNode): { coordinateBox: CoordinateBox | null; lod: Lod | null } | null {
    const region = get1(node, 'Region');
    if (region) {
        return {
            coordinateBox: getLatLonAltBox(region),
            lod: getLod(node),
        };
    }
    return null;
}

function getLod(node: XmlNode): Lod | null {
    const lod = get1(node, 'Lod');
    if (lod) {
        return [
            num1(lod, 'minLodPixels') ?? -1,
            num1(lod, 'maxLodPixels') ?? -1,
            num1(lod, 'minFadeExtent') ?? null,
            num1(lod, 'maxFadeExtent') ?? null,
        ];
    }
    return null;
}

function getLatLonAltBox(node: XmlNode): CoordinateBox | null {
    const latLonAltBox = get1(node, 'LatLonAltBox');
    if (latLonAltBox) {
        const north = num1(latLonAltBox, 'north');
        const west = num1(latLonAltBox, 'west');
        const east = num1(latLonAltBox, 'east');
        const south = num1(latLonAltBox, 'south');
        const altitudeMode = processAltitudeMode(
            get1(latLonAltBox, 'altitudeMode') || get1(latLonAltBox, 'gx:altitudeMode'),
        );
        if (altitudeMode) {
            console.debug('Encountered an unsupported feature of KML for togeojson: please contact developers for support of altitude mode.');
        }
        if (
            typeof north === 'number'
            && typeof south === 'number'
            && typeof west === 'number'
            && typeof east === 'number'
        ) {
            const bbox: BBox = [west, south, east, north];
            const coordinates: Polygon['coordinates'] = [
                [
                    [west, north], // top left
                    [east, north], // top right
                    [east, south], // top right
                    [west, south], // bottom left
                    [west, north], // top left (again)
                ],
            ];
            return {
                bbox,
                geometry: {
                    type: 'Polygon',
                    coordinates,
                },
            };
        }
    }
    return null;
}

function getLinkObject(node: XmlNode): P {
    /*
      <Link id="ID">
        <!-- specific to Link -->
        <href>...</href>                      <!-- string -->
        <refreshMode>onChange</refreshMode>
          <!-- refreshModeEnum: onChange, onInterval, or onExpire -->
        <refreshInterval>4</refreshInterval>  <!-- float -->
        <viewRefreshMode>never</viewRefreshMode>
          <!-- viewRefreshModeEnum: never, onStop, onRequest, onRegion -->
        <viewRefreshTime>4</viewRefreshTime>  <!-- float -->
        <viewBoundScale>1</viewBoundScale>    <!-- float -->
        <viewFormat>BBOX=[bboxWest],[bboxSouth],[bboxEast],[bboxNorth]</viewFormat>
                                              <!-- string -->
        <httpQuery>...</httpQuery>            <!-- string -->
      </Link>
    */
    const linkObj = get1(node, 'Link');
    if (linkObj) {
        return getMulti(linkObj, [
            'href',
            'refreshMode',
            'refreshInterval',
            'viewRefreshMode',
            'viewRefreshTime',
            'viewBoundScale',
            'viewFormat',
            'httpQuery',
        ]);
    }
    return {};
}

export function getNetworkLink(
    node: XmlNode,
    styleMap: StyleMap,
    schema: Schema,
    options: KmlOptions,
): F | null {
    const box = getNetworkLinkRegion(node);
    const geometry = box?.coordinateBox?.geometry || null;

    if (!geometry && options.skipNullGeometry) {
        return null;
    }

    const feature: F = {
        type: 'Feature',
        geometry,
        properties: Object.assign(
            /**
             * Related to
             * https://gist.github.com/tmcw/037a1cb6660d74a392e9da7446540f46
             */
            { '@geometry-type': 'networklink' },
            getMulti(node, [
                'name',
                'address',
                'visibility',
                'open',
                'phoneNumber',
                'styleUrl',
                'refreshVisibility',
                'flyToView',
                'description',
            ]),
            getMaybeHTMLDescription(node),
            extractCascadedStyle(node, styleMap),
            extractStyle(node),
            extractIconHref(node),
            extractExtendedData(node, schema),
            extractTimeSpan(node),
            extractTimeStamp(node),
            getLinkObject(node),
            box?.lod ? { lod: box.lod } : {},
        ),
    };

    if (box?.coordinateBox?.bbox) {
        feature.bbox = box.coordinateBox.bbox;
    }

    if (feature.properties?.visibility !== undefined) {
        feature.properties.visibility = feature.properties.visibility !== '0';
    }

    const id = getAttribute(node, 'id');
    if (id !== null && id !== '') feature.id = id;

    return feature;
}

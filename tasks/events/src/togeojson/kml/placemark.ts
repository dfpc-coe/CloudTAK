import type { Geometry } from 'geojson';
import type { F, KmlOptions } from '../types.ts';
import { getMulti } from '../shared.ts';
import { type XmlNode, getAttribute } from '../xml.ts';
import { extractStyle } from './extractStyle.ts';
import { getGeometry } from './geometry.ts';
import {
    type Schema,
    type StyleMap,
    extractCascadedStyle,
    extractExtendedData,
    extractTimeSpan,
    extractTimeStamp,
    getMaybeHTMLDescription,
} from './shared.ts';

function geometryListToGeometry(geometries: Geometry[]): Geometry | null {
    return geometries.length === 0
        ? null
        : geometries.length === 1
            ? geometries[0]
            : {
                    type: 'GeometryCollection',
                    geometries,
                };
}

export function getPlacemark(
    node: XmlNode,
    styleMap: StyleMap,
    schema: Schema,
    options: KmlOptions,
): F | null {
    const { coordTimes, geometries } = getGeometry(node);
    const geometry = geometryListToGeometry(geometries);

    if (!geometry && options.skipNullGeometry) {
        return null;
    }

    const feature: F = {
        type: 'Feature',
        geometry,
        properties: Object.assign(
            getMulti(node, [
                'name',
                'address',
                'visibility',
                'open',
                'phoneNumber',
                'description',
            ]),
            getMaybeHTMLDescription(node),
            extractCascadedStyle(node, styleMap),
            extractStyle(node),
            extractExtendedData(node, schema),
            extractTimeSpan(node),
            extractTimeStamp(node),
            coordTimes.length
                ? {
                        coordinateProperties: {
                            times: coordTimes.length === 1 ? coordTimes[0] : coordTimes,
                        },
                    }
                : {},
        ),
    };

    if (feature.properties?.visibility !== undefined) {
        feature.properties.visibility = feature.properties.visibility !== '0';
    }

    const id = getAttribute(node, 'id');
    if (id !== null && id !== '') feature.id = id;

    return feature;
}

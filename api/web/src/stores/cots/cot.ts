import { bbox } from '@turf/bbox'
import { Type } from '@sinclair/typebox';
import { useMapStore } from '../map.ts';
import pointOnFeature from '@turf/point-on-feature';
import type { Static } from '@sinclair/typebox';
import type { Feature } from './../../types.ts'
import type {
    BBox as GeoJSONBBox,
    Feature as GeoJSONFeature,
    Geometry as GeoJSONGeometry,
} from 'geojson'

export const RENDERED_PROPERTIES = [
    'callsign',
    'fill',
    'fill-opacity',
    'stroke',
    'group',
    'icon',
    'course',
    'icon-opacity',
    'stroke-opacity',
    'marker-color',
    'marker-radius',
    'marker-opacity',
    'circle-color',
    'circle-radius',
    'circle-opacity'
]

export default class COT implements Feature {
    id: string;
    path: string;
    type: 'Feature';
    properties: Feature["properties"];
    geometry: Feature["geometry"];

    constructor(feat: Feature) {
        this.id = feat.id;
        this.type = feat.type;
        this.path = feat.path;
        this.properties = feat["properties"];
        this.geometry = feat["geometry"];
    }

    /**
     * Update the COT and return a boolean as to whether the COT needs to be re-rendered
     */
    update(feat: Feature): boolean {
        let changed = false;
        for (const prop of RENDERED_PROPERTIES) {
            if (this.properties[prop] !== feat.properties[prop]) {
                changed = true;
                break;
            }
        }

        this.properties = feat["properties"];

        //TODO Detect Geometry changes, use centroid?!
        this.geometry = feat["geometry"];

        return changed;
    }

    /**
     * The slimmer we can get the Features, the better
     * This returns the minium feature we need to actually style the COT in the vector tiles
     */
    as_rendered(): GeoJSONFeature<GeoJSONGeometry, Record<string, unknown>> {
        const feat: GeoJSONFeature<GeoJSONGeometry, Record<string, unknown>> = {
            id: this.id,
            type: this.type,
            properties: {
                id: this.id,        //Vector Tiles only support integer IDs so store in props
                callsign: this.properties.callsign,
            },
            geometry: this.geometry
        };

        if (!feat.properties) feat.properties = {};

        for (const prop of RENDERED_PROPERTIES) {
            if (this.properties[prop] !== undefined) {
                feat.properties[prop] = this.properties[prop];
            }
        }

        return feat;
    }

    bounds(): GeoJSONBBox {
        return bbox(this.geometry)    
    }

    /**
     * Consistent feature manipulation between add & update
     */
    static style(feat: Feature): Feature {
        if (!feat.properties.center) {
            feat.properties.center = pointOnFeature(feat.geometry).geometry.coordinates;
        }

        if (!feat.properties.time) feat.properties.time = new Date().toISOString();
        if (!feat.properties.start) feat.properties.start = new Date().toISOString();
        if (!feat.properties.stale) {
            const currentTime = new Date();
            currentTime.setMinutes(currentTime.getMinutes() + 10);
            feat.properties.stale = currentTime.toISOString();
        }

        if (!feat.properties.remarks) {
            feat.properties.remarks = 'None';
        }

        if (!feat.properties.how && feat.properties.type.startsWith('u-')) {
            feat.properties.how = 'h-g-i-g-o';
        } else if (!feat.properties.how) {
            feat.properties.how = 'm-p';
        }

        if (feat.geometry.type.includes('Point')) {
            if (feat.properties.group) {
                feat.properties['icon-opacity'] = 0;

                if (feat.properties.group.name === 'Yellow') {
                    feat.properties["marker-color"] = '#f59f00';
                } else if (feat.properties.group.name === 'Orange') {
                    feat.properties["marker-color"] = '#f76707';
                } else if (feat.properties.group.name === 'Magenta') {
                    feat.properties["marker-color"] = '#ea4c89';
                } else if (feat.properties.group.name === 'Red') {
                    feat.properties["marker-color"] = '#d63939';
                } else if (feat.properties.group.name === 'Maroon') {
                    feat.properties["marker-color"] = '#bd081c';
                } else if (feat.properties.group.name === 'Purple') {
                    feat.properties["marker-color"] = '#ae3ec9';
                } else if (feat.properties.group.name === 'Dark Blue') {
                    feat.properties["marker-color"] = '#0054a6';
                } else if (feat.properties.group.name === 'Blue') {
                    feat.properties["marker-color"] = '#4299e1';
                } else if (feat.properties.group.name === 'Cyan') {
                    feat.properties["marker-color"] = '#17a2b8';
                } else if (feat.properties.group.name === 'Teal') {
                    feat.properties["marker-color"] = '#0ca678';
                } else if (feat.properties.group.name === 'Green') {
                    feat.properties["marker-color"] = '#74b816';
                } else if (feat.properties.group.name === 'Dark Green') {
                    feat.properties["marker-color"] = '#2fb344';
                } else if (feat.properties.group.name === 'Brown') {
                    feat.properties["marker-color"] = '#dc4e41';
                } else {
                    feat.properties["marker-color"] = '#ffffff';
                }

            } else if (feat.properties.icon) {
                // Format of icon needs to change for spritesheet
                if (!feat.properties.icon.includes(':')) {
                    feat.properties.icon = feat.properties.icon.replace('/', ':')
                }

                if (feat.properties.icon.endsWith('.png')) {
                    feat.properties.icon = feat.properties.icon.replace(/.png$/, '');
                }

                const mapStore = useMapStore();
                if (mapStore.map && !mapStore.map.hasImage(feat.properties.icon)) {
                    console.warn(`No Icon for: ${feat.id}::${feat.properties.icon} fallback to ${feat.properties.type}`);
                    feat.properties.icon = `${feat.properties.type}`;
                }
            } else {
                // TODO Only add icon if one actually exists in the spritejson
                if (!['u-d-p'].includes(feat.properties.type)) {
                    feat.properties.icon = `${feat.properties.type}`;
                }
            }
        } else if (feat.geometry.type.includes('Line') || feat.geometry.type.includes('Polygon')) {
            if (!feat.properties['stroke']) feat.properties.stroke = '#d63939';
            if (!feat.properties['stroke-style']) feat.properties['stroke-style'] = 'solid';
            if (!feat.properties['stroke-width']) feat.properties['stroke-width'] = 3;

            if (!feat.properties['stroke-opacity'] === undefined) {
                feat.properties['stroke-opacity'] = 1;
            }

            if (feat.geometry.type.includes('Polygon')) {
                if (!feat.properties['fill']) feat.properties.fill = '#d63939';

                if (feat.properties['fill-opacity'] === undefined) {
                    feat.properties['fill-opacity'] = 1;
                }
            }
        }

        return feat;
    }
}

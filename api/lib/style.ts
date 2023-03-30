import jsonata from 'jsonata';
import { Feature } from 'geojson';

/**
 * Apply layer styling to CoT Messages
 * @class
 *
 * @prop {Layer} layer  Layer object
 */
export default class Style {
    layer: any;

    constructor(layer: any) {
        this.layer = layer;
    }

    /**
     * Apply styling to a GeoJSON Feature in-place
     *
     * @param feature       GeoJSON Feature
     * @returns             GeoJSON Feature
     */
    async feat(feature: Feature): Promise<Feature> {
        if (this.layer.stale) {
            feature.properties.stale = this.layer.stale;
        }

        if (!this.layer.enabled_styles) {
            return feature;
        } else if (this.layer.styles.queries) {
            for (const q of this.layer.styles.queries) {
                const expression = jsonata(q.query);

                if (await expression.evaluate(feature) === true) {
                    this.#by_geom(q.styles, feature);
                }
            }

            return feature;
        } else {
            this.#by_geom(this.layer.styles, feature);

            return feature;
        }
    }

    #by_geom(style: any, feature: Feature) {
        if (feature.geometry.type === 'Point' && style.point) {
            Object.assign(feature.properties, style.point);
        } else if (feature.geometry.type === 'LineString' && style.line) {
            Object.assign(feature.properties, style.line);
        } else if (feature.geometry.type === 'Polygon' && style.polygon) {
            Object.assign(feature.properties, style.polygon);
        }
    }
}

import jsonata from 'jsonata';

/**
 * Apply layer styling to CoT Messages
 * @class
 *
 * @prop {Layer} layer  Layer object
 */
export default class Style {
    constructor(layer) {
        this.layer = layer;
    }

    /**
     * Apply styling to a GeoJSON Feature in-place
     *
     * @param {Object} feature     GeoJSON Feature
     * @returns {Object} GeoJSON Feature
     */
    async feat(feature) {
        if (this.layer.data.stale) {
            feature.properties.stale = this.layer.data.stale;
        }

        if (!this.layer.enabled_styles) return feature;

        if (this.layer.styles.queries) {
            for (const q of this.layer.styles.queries) {
                const expression = jsonata(q.query);

                if (await expression.evaluate(feature) === true) {
                    this.#by_geom(feature);
                }
            }
        } else {
            this.#by_geom(this.layer.styles, feature);
        }
    }

    #by_geom(style, feature) {
        if (feature.geometry.type === 'Point' && style.point) {
            Object.assign(feature.properties, style.point);
        } else if (feature.geometry.type === 'LineString' && style.line) {
            Object.assign(feature.properties, style.line);
        } else if (feature.geometry.type === 'Polygon' && style.polygon) {
            Object.assign(feature.properties, style.polygon);
        }
    }
}

import jsonata from 'jsonata';
import { Feature } from 'geojson';
import handlebars from 'handlebars';
import Err from '@openaddresses/batch-error';

export type StyleContainer = {
    line?: StyleLine;
    point?: StylePoint;
    polygon?: StylePolygon;
    queries?: Array<StyleSingleContainer>;
}

export type StyleSingleContainer = {
    query: string;
    styles: StyleSingle
}

export type StyleSingle = {
    line?: StyleLine;
    point?: StylePoint;
    polygon?: StylePolygon;

}

// Also note these are defined in schema/util/styles.json
export type StylePoint = {
    color?: string;
    remarks?: string;
    callsign?: string;
};
export type StyleLine = {
    stroke?: string;
    'stroke-style'?: string;
    'stroke-opacity'?: string;
    'stroke-width'?: string;
    remarks?: string;
    callsign?: string;
};
export type StylePolygon = {
    stroke?: string;
    'stroke-style'?: string;
    'stroke-opacity'?: string;
    'stroke-width'?: string;
    fill?: string;
    'fill-opacity'?: string;
    remarks?: string;
    callsign?: string;
};

export interface StyleInterface {
    stale: number;    
    enabled_styles: boolean;
    styles: StyleContainer;
}


/**
 * Apply layer styling to CoT Messages
 * @class
 *
 * @prop layer - Layer object
 */
export default class Style {
    style: StyleInterface;

    constructor(style: StyleInterface) {
        this.style = style;
    }

    static validate(styles: StyleContainer) {
        try {
            if (styles.queries) {
                for (const q of styles.queries) {
                    jsonata(q.query);
                }
            }

            return true;
        } catch (err) {
            throw new Err(400, err instanceof Error ? err : new Error(String(err)), err instanceof Error ? err.message : String(err));
        }
    }

    /**
     * Apply styling to a GeoJSON Feature in-place
     *
     * @param feature       GeoJSON Feature
     * @returns             GeoJSON Feature
     */
    async feat(feature: Feature): Promise<Feature> {
        if (!feature.properties) feature.properties = {};

        if (this.style.stale && !feature.properties.stale) {
            feature.properties.stale = this.style.stale;
        }

        if (!this.style.enabled_styles) {
            return feature;
        } else if (this.style.styles.queries) {
            for (const q of this.style.styles.queries) {
                const expression = jsonata(q.query);

                if (await expression.evaluate(feature) === true) {
                    this.#by_geom(q.styles, feature);
                }
            }

            return feature;
        } else {
            this.#by_geom(this.style.styles, feature);

            return feature;
        }
    }

    #by_geom(style: StyleSingle, feature: Feature) {
        if (!feature.properties) feature.properties = {};

        if (feature.geometry.type === 'Point' && style.point) {
            if (!style.point.remarks) delete style.point.remarks;
            if (!style.point.callsign) delete style.point.callsign;

            Object.assign(feature.properties, style.point);
        } else if (feature.geometry.type === 'LineString' && style.line) {
            if (!style.line.remarks) delete style.line.remarks;
            if (!style.line.callsign) delete style.line.callsign;

            Object.assign(feature.properties, style.line);
        } else if (feature.geometry.type === 'Polygon' && style.polygon) {
            if (!style.polygon.remarks) delete style.polygon.remarks;
            if (!style.polygon.callsign) delete style.polygon.callsign;

            Object.assign(feature.properties, style.polygon);
        }

        // Properties that support Templating
        for (const prop of ['remarks', 'callsign']) {
            if (!feature.properties[prop]) continue;
            feature.properties[prop] = handlebars.compile(feature.properties[prop])(feature.properties);
        }
    }
}

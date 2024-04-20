import { Type, Static } from '@sinclair/typebox'
import jsonata from 'jsonata';
import { Feature } from 'geojson';
import handlebars from 'handlebars';
import Err from '@openaddresses/batch-error';

export const StyleLink = Type.Object({
    remarks: Type.String(),
    url: Type.String()
});

export const StylePoint = Type.Object({
    color: Type.Optional(Type.String()),
    remarks: Type.Optional(Type.String()),
    callsign: Type.Optional(Type.String()),
    links: Type.Optional(Type.Array(StyleLink)),
    icon: Type.Optional(Type.String())
});

export const StyleLine = Type.Object({
    stroke: Type.Optional(Type.String()),
    'stroke-style': Type.Optional(Type.String()),
    'stroke-opacity': Type.Optional(Type.String()),
    'stroke-width': Type.Optional(Type.String()),
    remarks: Type.Optional(Type.String()),
    callsign: Type.Optional(Type.String()),
    links: Type.Optional(Type.Array(StyleLink)),
});

export const StylePolygon = Type.Object({
    stroke: Type.Optional(Type.String()),
    'stroke-style': Type.Optional(Type.String()),
    'stroke-opacity': Type.Optional(Type.String()),
    'stroke-width': Type.Optional(Type.String()),
    fill: Type.Optional(Type.String()),
    'fill-opacity': Type.Optional(Type.String()),
    remarks: Type.Optional(Type.String()),
    callsign: Type.Optional(Type.String()),
    links: Type.Optional(Type.Array(StyleLink)),
});

export const StyleSingle = Type.Object({
    remarks: Type.Optional(Type.String()),
    callsign: Type.Optional(Type.String()),
    links: Type.Optional(Type.Array(StyleLink)),
    line: Type.Optional(StyleLine),
    point: Type.Optional(StylePoint),
    polygon: Type.Optional(StylePolygon)
})

export const StyleSingleContainer = Type.Object({
    query: Type.String(),
    styles: StyleSingle
})

export const StyleContainer = Type.Object({
    line: Type.Optional(StyleLine),
    point: Type.Optional(StylePoint),
    polygon: Type.Optional(StylePolygon),
    remarks: Type.Optional(Type.String()),
    callsign: Type.Optional(Type.String()),
    links: Type.Optional(Type.Array(StyleLink)),
    queries: Type.Optional(Type.Array(StyleSingleContainer))
})

export interface StyleInterface {
    stale: number;
    enabled_styles: boolean;
    styles: Static<typeof StyleContainer>;
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
        if (!this.style.styles.queries) this.style.styles.queries = [];
    }

    static validate(styles: Static<typeof StyleContainer>) {
        try {
            if (styles.queries) {
                for (const q of styles.queries) {
                    jsonata(q.query);
                }
            }

            return true;
        } catch (err) {
            throw new Err(400, err, err instanceof Error ? err.message : String(err));
        }
    }

    /**
     * Apply styling to a GeoJSON Feature in-place
     *
     * @param feature       GeoJSON Feature
     * @returns             GeoJSON Feature
     */
    async feat(feature: Feature): Promise<Feature> {
        try {
            if (!feature.properties) feature.properties = {};

            if (this.style.stale && !feature.properties.stale) {
                feature.properties.stale = this.style.stale;
            }

            if (!this.style.enabled_styles) return feature;
            if (!feature.properties.metadata) feature.properties.metadata = {};

            // Properties that support Templating
            for (const prop of ['remarks', 'callsign']) {
                if (!this.style.styles[prop]) continue;
                feature.properties[prop] = handlebars.compile(this.style.styles[prop])(feature.properties.metadata);
            }

            if (this.style.styles.links) {
                this.#links(this.style.styles.links, feature);
            }

            this.#by_geom(this.style.styles, feature);

            for (const q of this.style.styles.queries) {
                try {
                    const expression = jsonata(q.query);

                    if (await expression.evaluate(feature) === true) {
                        if (q.links) this.#links(q.links, feature);
                        this.#by_geom(q.styles, feature);
                    }
                } catch (err) {
                    // Ignore queries that result in invalid output - this is explicitly allowed
                }
            }

            return feature;
        } catch (err) {
            throw new Err(400, err, err instanceof Error ? err.message : String(err));
        }
    }

    #links(links: Array<Static<typeof StyleLink>>, feature: Feature) {
        if (!feature.properties.links) feature.properties.links = [];
        for (const link of links) {
            feature.properties.links.push({
                uid: feature.id,
                relation: 'r-u',
                mime: 'text/html',
                url: handlebars.compile(link.url)(feature.properties.metadata),
                remarks: handlebars.compile(link.remarks)(feature.properties.metadata),
            })
        }
    }

    #by_geom(style: Static<typeof StyleSingle>, feature: Feature) {
        if (!feature.properties) feature.properties = {};

        if (feature.geometry.type === 'Point' && style.point) {
            if (!style.point.remarks) delete style.point.remarks;
            if (!style.point.callsign) delete style.point.callsign;

            if (style.point.links) {
                this.#links(style.point.links, feature);
                delete style.point.links;
            }

            Object.assign(feature.properties, style.point);
        } else if (feature.geometry.type === 'LineString' && style.line) {
            if (!style.line.remarks) delete style.line.remarks;
            if (!style.line.callsign) delete style.line.callsign;

            if (style.line.links) {
                this.#links(style.line.links, feature);
                delete style.line.links;
            }

            Object.assign(feature.properties, style.line);
        } else if (feature.geometry.type === 'Polygon' && style.polygon) {
            if (!style.polygon.remarks) delete style.polygon.remarks;
            if (!style.polygon.callsign) delete style.polygon.callsign;

            if (style.polygon.links) {
                this.#links(style.polygon.links, feature);
                delete style.polygon.links;
            }

            Object.assign(feature.properties, style.polygon);
        }

        // Properties that support Templating
        for (const prop of ['remarks', 'callsign']) {
            if (!feature.properties[prop]) continue;
            feature.properties[prop] = handlebars.compile(feature.properties[prop])(feature.properties.metadata);
        }
    }
}

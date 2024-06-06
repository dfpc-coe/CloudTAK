import { Type, Static } from '@sinclair/typebox'
import jsonata from 'jsonata';
import { Feature } from 'geojson';
import handlebars from 'handlebars';
import Err from '@openaddresses/batch-error';

interface ValidateStyle {
    callsign?: string;
    remarks?: string;
    links?: Array<Static<typeof StyleLink>>;
    point?: { callsign?: string; remarks?: string; links?: Array<Static<typeof StyleLink>> };
    line?: { callsign?: string; remarks?: string; links?: Array<Static<typeof StyleLink>> };
    polygon?: { callsign?: string; remarks?: string; links?: Array<Static<typeof StyleLink>> };
}

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
    remarks: Type.Optional(Type.String()),
    callsign: Type.Optional(Type.String()),
    links: Type.Optional(Type.Array(StyleLink)),
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
            this.#validateTemplate(styles);

            if (styles.queries) {
                for (const q of styles.queries) {
                    jsonata(q.query);

                    this.#validateTemplate(q.styles);
                }
            }

            return true;
        } catch (err) {
            if (err instanceof Err) {
                throw err;
            } else if (err instanceof Error) {
                throw new Err(400, err, err.message);
            } else {
                throw new Err(400, new Error(String(err)), String(err));
            }
        }
    }

    static #validateTemplate(style: ValidateStyle) {
        if (style.callsign) {
            try {
                handlebars.compile(style.callsign)({});
            } catch (err) {
                throw new Err(400, err, `Invalid Callsign Template: ${style.callsign}`)
            }
        }

    
        if (style.remarks) {
            try {
                handlebars.compile(style.remarks)({});
            } catch (err) {
                throw new Err(400, err, `Invalid Remarks Template: ${style.remarks}`)
            }
        }

        if (style.links) {
            this.#validateLinks(style.links);
        }

        for (const type of ['point', 'polygon', 'line']) {
            if (type in style) {
                if (style[type].links) this.#validateLinks(style[type].links);

                if (style[type].callsign) {
                    try {
                        handlebars.compile(style[type].callsign)({});
                    } catch (err) {
                        throw new Err(400, err, `Invalid (${type}) Callsign Template: ${style[type].callsign}`)
                    }
                }

                if (style[type].remarks) {
                    try {
                        handlebars.compile(style[type].remarks)({});
                    } catch (err) {
                        throw new Err(400, err, `Invalid (${type}) Remarks Template: ${style[type].remarks}`)
                    }
                }
            }
        }
    }

    static #validateLinks(links: Array<Static<typeof StyleLink>>): void {
        for (const link of links) {
            try {
                handlebars.compile(link.url)({});
            } catch (err) {
                throw new Err(400, err, `Invalid Link URL: ${link.url}`)
            }

            try {
                handlebars.compile(link.remarks)({});
            } catch (err) {
                throw new Err(400, err, `Invalid Link Remarks: ${link.remarks}`)
            }
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
                feature.properties.stale = this.style.stale * 1000;
            }

            if (!this.style.enabled_styles) return feature;
            if (!feature.properties.metadata) feature.properties.metadata = {};

            // Properties that support Templating
            if (this.style.styles.callsign) feature.properties.callsign = handlebars.compile(this.style.styles.callsign)(feature.properties.metadata);
            if (this.style.styles.remarks) feature.properties.remarks = handlebars.compile(this.style.styles.remarks)(feature.properties.metadata);


            if (this.style.styles.links) {
                this.#links(this.style.styles.links, feature);
            }

            this.#by_geom(this.style.styles, feature);

            if (!this.style.styles.queries) this.style.styles.queries = [];
            for (const q of this.style.styles.queries) {
                try {
                    const expression = jsonata(q.query);

                    if (await expression.evaluate(feature) === true) {
                        if (q.styles.callsign) feature.properties.callsign = handlebars.compile(q.styles.callsign)(feature.properties.metadata);
                        if (q.styles.remarks) feature.properties.remarks = handlebars.compile(q.styles.remarks)(feature.properties.metadata);

                        if (q.links) this.#links(q.links, feature);

                        this.#by_geom(q.styles, feature);
                    }
                } catch (err) {
                    // Ignore queries that result in invalid output - this is explicitly allowed
                }
            }

            return feature;
        } catch (err) {
            if (err instanceof Error) {
                throw new Err(400, err, err.message);
            } else {
                throw new Err(400, new Error(String(err)), String(err));
            }
        }
    }

    #links(links: Array<Static<typeof StyleLink>>, feature: Feature) {
        if (!feature.properties) feature.properties = {};
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
            if (style.point.remarks) feature.properties.remarks = handlebars.compile(style.point.remarks)(feature.properties.metadata);
            if (style.point.callsign) feature.properties.callsign = handlebars.compile(style.point.callsign)(feature.properties.metadata);
            if (style.point.links) this.#links(style.point.links, feature);

            Object.keys(style.point)
                .filter((k) => { return !['links', 'remarks', 'callsign'].includes(k) })
                .forEach((k) => { feature.properties[k] = style.point[k] });
        } else if (feature.geometry.type === 'LineString' && style.line) {
            if (style.line.remarks) feature.properties.remarks = handlebars.compile(style.line.remarks)(feature.properties.metadata);
            if (style.line.callsign) feature.properties.callsign = handlebars.compile(style.line.callsign)(feature.properties.metadata);
            if (style.line.links) this.#links(style.line.links, feature);

            Object.keys(style.line)
                .filter((k) => { return !['links', 'remarks', 'callsign'].includes(k) })
                .forEach((k) => { feature.properties[k] = style.line[k] });
        } else if (feature.geometry.type === 'Polygon' && style.polygon) {
            if (style.polygon.remarks) feature.properties.remarks = handlebars.compile(style.polygon.remarks)(feature.properties.metadata);
            if (style.polygon.callsign) feature.properties.callsign = handlebars.compile(style.polygon.callsign)(feature.properties.metadata);
            if (style.polygon.links) this.#links(style.polygon.links, feature);

            Object.keys(style.polygon)
                .filter((k) => { return !['links', 'remarks', 'callsign'].includes(k) })
                .forEach((k) => { feature.properties[k] = style.polygon[k] });
        }
    }
}

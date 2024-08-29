import { Type, Static } from '@sinclair/typebox'
import jsonata from 'jsonata';
import type { Feature } from '@tak-ps/node-cot';
import handlebars from 'handlebars';
import Err from '@openaddresses/batch-error';

interface ValidateStyle {
    id?: string;
    callsign?: string;
    remarks?: string;
    links?: Array<Static<typeof StyleLink>>;
    point?:     { callsign?: string; id?: string; type?: string; remarks?: string; links?: Array<Static<typeof StyleLink>> };
    line?:      { callsign?: string; id?: string; remarks?: string; links?: Array<Static<typeof StyleLink>> };
    polygon?:   { callsign?: string; id?: string; remarks?: string; links?: Array<Static<typeof StyleLink>> };
}

interface validateStyleGeometry {
    'marker-color'?: string;
    'marker-opacity'?: string;
    id?: string;
    type?: string;
    remarks?: string;
    callsign?: string;
    links?: Static<typeof StyleLink>[],
    icon?: string;
    stroke?: string;
    'stroke-style'?: string;
    'stroke-opacity'?: string;
    'stroke-width'?: string;
    fill?: string;
    'fill-opacity'?: string;
};

export const StyleLink = Type.Object({
    remarks: Type.String(),
    url: Type.String()
});

export const StylePoint = Type.Object({
    'marker-color': Type.Optional(Type.String()),
    'marker-opacity': Type.Optional(Type.String()),
    id: Type.Optional(Type.String()),
    type: Type.Optional(Type.String()),
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
    id: Type.Optional(Type.String()),
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
    id: Type.Optional(Type.String()),
    remarks: Type.Optional(Type.String()),
    callsign: Type.Optional(Type.String()),
    links: Type.Optional(Type.Array(StyleLink)),
});

export const StyleSingle = Type.Object({
    id: Type.Optional(Type.String()),
    remarks: Type.Optional(Type.String()),
    callsign: Type.Optional(Type.String()),
    links: Type.Optional(Type.Array(StyleLink)),
    line: Type.Optional(StyleLine),
    point: Type.Optional(StylePoint),
    polygon: Type.Optional(StylePolygon)
})

export const StyleSingleContainer = Type.Object({
    query: Type.String(),
    id: Type.Optional(Type.String()),
    remarks: Type.Optional(Type.String()),
    callsign: Type.Optional(Type.String()),
    links: Type.Optional(Type.Array(StyleLink)),
    styles: StyleSingle
})

export const StyleContainer = Type.Object({
    line: Type.Optional(StyleLine),
    point: Type.Optional(StylePoint),
    polygon: Type.Optional(StylePolygon),
    id: Type.Optional(Type.String()),
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
    templates: Map<string, HandlebarsTemplateDelegate<any>>;

    constructor(style: StyleInterface) {
        this.style = style;
        this.templates = new Map();
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
        if (style.id) {
            try {
                handlebars.compile(style.id)({});
            } catch (err) {
                throw new Err(400, err instanceof Error ? err : new Error(String(err)), `Invalid ID Template: ${style.id}`)
            }
        }

        if (style.callsign) {
            try {
                handlebars.compile(style.callsign)({});
            } catch (err) {
                throw new Err(400, err instanceof Error ? err : new Error(String(err)), `Invalid Callsign Template: ${style.callsign}`)
            }
        }


        if (style.remarks) {
            try {
                handlebars.compile(style.remarks)({});
            } catch (err) {
                throw new Err(400, err instanceof Error ? err : new Error(String(err)), `Invalid Remarks Template: ${style.remarks}`)
            }
        }

        if (style.links) {
            this.#validateLinks(style.links);
        }

        if (style.point) this.#validateTemplateGeometry(style.point, 'point');
        if (style.polygon) this.#validateTemplateGeometry(style.polygon, 'polygon');
        if (style.line) this.#validateTemplateGeometry(style.line, 'line');
    }

    static #validateTemplateGeometry(style: validateStyleGeometry, type: string) {
        if (style.links) this.#validateLinks(style.links);

        if (style.id) {
            try {
                handlebars.compile(style.id)({});
            } catch (err) {
                throw new Err(400, err instanceof Error ? err : new Error(String(err)), `Invalid (${type}) ID Template: ${style.id}`)
            }
        }

        if (style.type) {
            try {
                handlebars.compile(style.type)({});
            } catch (err) {
                throw new Err(400, err instanceof Error ? err : new Error(String(err)), `Invalid (${type}) Type Template: ${style.type}`)
            }
        }

        if (style.callsign) {
            try {
                handlebars.compile(style.callsign)({});
            } catch (err) {
                throw new Err(400, err instanceof Error ? err : new Error(String(err)), `Invalid (${type}) Callsign Template: ${style.callsign}`)
            }
        }

        if (style.remarks) {
            try {
                handlebars.compile(style.remarks)({});
            } catch (err) {
                throw new Err(400, err instanceof Error ? err : new Error(String(err)), `Invalid (${type}) Remarks Template: ${style.remarks}`)
            }
        }
    }

    static #validateLinks(links: Array<Static<typeof StyleLink>>): void {
        for (const link of links) {
            try {
                handlebars.compile(link.url)({});
            } catch (err) {
                throw new Err(400, err instanceof Error ? err : new Error(String(err)), `Invalid Link URL: ${link.url}`)
            }

            try {
                handlebars.compile(link.remarks)({});
            } catch (err) {
                throw new Err(400, err instanceof Error ? err : new Error(String(err)), `Invalid Link Remarks: ${link.remarks}`)
            }
        }
    }

    /**
     * Compile and run a template or use a cached template for performance
     */
    compile(template, props) {
        let t = this.templates.get(template);

        if (!t) {
            t = handlebars.compile(template)
            this.templates.set(template, t);
        }

        return t(props);
    }

    /**
     * Apply styling to a GeoJSON Feature in-place
     *
     * @param feature       GeoJSON Feature
     * @returns             GeoJSON Feature
     */
    async feat(feature: Static<typeof Feature.InputFeature>): Promise<Static<typeof Feature.InputFeature>> {
        try {
            if (!feature.properties) feature.properties = {};

            if (this.style.stale && !feature.properties.stale) {
                feature.properties.stale = this.style.stale * 1000;
            }

            if (!this.style.enabled_styles) return feature;
            if (!feature.properties.metadata) feature.properties.metadata = {};

            // Properties that support Templating
            if (this.style.styles.id) feature.id = this.compile(this.style.styles.id, feature.properties.metadata);
            if (this.style.styles.callsign) feature.properties.callsign = this.compile(this.style.styles.callsign, feature.properties.metadata);
            if (this.style.styles.remarks) feature.properties.remarks = this.compile(this.style.styles.remarks, feature.properties.metadata);


            if (this.style.styles.links) {
                this.#links(this.style.styles.links, feature);
            }

            this.#by_geom(this.style.styles, feature);

            if (!this.style.styles.queries) this.style.styles.queries = [];
            for (const q of this.style.styles.queries) {
                try {
                    const expression = jsonata(q.query);

                    if (await expression.evaluate(feature) === true) {
                        if (q.styles.id) feature.id = this.compile(q.styles.id, feature.properties.metadata);
                        if (q.styles.callsign) feature.properties.callsign = this.compile(q.styles.callsign, feature.properties.metadata);
                        if (q.styles.remarks) feature.properties.remarks = this.compile(q.styles.remarks, feature.properties.metadata);

                        if (q.links) this.#links(q.links, feature);

                        this.#by_geom(q.styles, feature);
                    }

                // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

    #links(links: Array<Static<typeof StyleLink>>, feature: Static<typeof Feature.InputFeature>) {
        if (!feature.properties) feature.properties = {};
        if (!feature.properties.links) feature.properties.links = [];
        for (const link of links) {
            feature.properties.links.push({
                uid: feature.id,
                relation: 'r-u',
                mime: 'text/html',
                url: this.compile(link.url, feature.properties.metadata),
                remarks: this.compile(link.remarks, feature.properties.metadata),
            })
        }
    }

    #by_geom(style: Static<typeof StyleSingle>, feature: Static<typeof Feature.InputFeature>) {
        if (!feature.properties) feature.properties = {};

        if (feature.geometry.type === 'Point' && style.point) {
            if (style.point.id) feature.id = this.compile(style.point.id, feature.properties.metadata);
            if (style.point.type) feature.properties.type = this.compile(style.point.type, feature.properties.metadata);
            if (style.point.remarks) feature.properties.remarks = this.compile(style.point.remarks, feature.properties.metadata);
            if (style.point.callsign) feature.properties.callsign = this.compile(style.point.callsign, feature.properties.metadata);
            if (style.point.links) this.#links(style.point.links, feature);

            Object.keys(style.point)
                .filter((k) => { return !['links', 'remarks', 'callsign'].includes(k) })
                .forEach((k) => { feature.properties[k] = style.point[k] });
        } else if (feature.geometry.type === 'LineString' && style.line) {
            if (style.line.id) feature.id = this.compile(style.line.id, feature.properties.metadata);
            if (style.line.remarks) feature.properties.remarks = this.compile(style.line.remarks, feature.properties.metadata);
            if (style.line.callsign) feature.properties.callsign = this.compile(style.line.callsign, feature.properties.metadata);
            if (style.line.links) this.#links(style.line.links, feature);

            Object.keys(style.line)
                .filter((k) => { return !['links', 'remarks', 'callsign'].includes(k) })
                .forEach((k) => { feature.properties[k] = style.line[k] });
        } else if (feature.geometry.type === 'Polygon' && style.polygon) {
            if (style.polygon.id) feature.id = this.compile(style.polygon.id, feature.properties.metadata);
            if (style.polygon.remarks) feature.properties.remarks = this.compile(style.polygon.remarks, feature.properties.metadata);
            if (style.polygon.callsign) feature.properties.callsign = this.compile(style.polygon.callsign, feature.properties.metadata);
            if (style.polygon.links) this.#links(style.polygon.links, feature);

            Object.keys(style.polygon)
                .filter((k) => { return !['links', 'remarks', 'callsign'].includes(k) })
                .forEach((k) => { feature.properties[k] = style.polygon[k] });
        }
    }
}

import { Type, Static } from '@sinclair/typebox'
import jsonata from 'jsonata';
import type { Feature } from '@tak-ps/node-cot';
import handlebars from 'handlebars';
import Err from '@openaddresses/batch-error';
import sanitizer from 'sanitize-html';

handlebars.registerHelper('fallback', (...params: Array<unknown>) => {
    params.pop(); // Contains Config stuff from handlebars
    const found = params.find(el => !!el)
    return found;
})

handlebars.registerHelper('slice', (text: string, start: number, end?: number) => {
    if (text && !isNaN(Number(start)) && !isNaN(Number(end))) {
        return text.substring(start, end);
    } else if (text && !isNaN(Number(start))) {
        return text.substring(start);
    } else {
        return '';
    }
});

handlebars.registerHelper('htmlstrip', (text: string) => {
    if (!text) return '';

    let addLine = false;
    let addSpace = false;
    const newLine = ['tr'];
    const newSpace = ['td'];

    return sanitizer(text, {
        allowedTags: [],
        onCloseTag: (tagName) => {
            addLine = newLine.includes(tagName);
            addSpace = newSpace.includes(tagName);
        },
        textFilter: (text) => {
            if (addLine) {
                addLine = false;
                text = '\n' + text;
            }

            if (addSpace) {
                addSpace = false;
                text = ': ' + text;
            }

            return text;
        }
    }).trim();
});

// Replace all occurrences of a search string with replacement text
// Usage: {{replace currentMessage '[nl]' ' '}} or chained {{replace (replace text '[nl]' ' ') '[np]' ' '}}
handlebars.registerHelper('replace', (text: string, search: string, replacement: string) => {
    if (!text) return '';
    return text.replaceAll(search, replacement);
});

// Round numbers to specified decimal places (defaults to 2)
// Usage: {{round depth 2}} or {{round magnitude 1}}
handlebars.registerHelper('round', (number: number, decimals: number = 2) => {
    if (number == null || isNaN(number)) return '';
    return Number(number).toFixed(decimals);
});

interface validateStyleGeometry {
    'marker-color'?: string;
    'marker-opacity'?: string;
    id?: string;
    type?: string;
    remarks?: string;
    minzoom?: number | string;
    maxzoom?: number | string;
    stale?: number | string;
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
    stale: Type.Optional(Type.Union([Type.Number(), Type.String()])),
    minzoom: Type.Optional(Type.Union([Type.Number(), Type.String()])),
    maxzoom: Type.Optional(Type.Union([Type.Number(), Type.String()])),
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
    stale: Type.Optional(Type.Union([Type.Number(), Type.String()])),
    minzoom: Type.Optional(Type.Union([Type.Number(), Type.String()])),
    maxzoom: Type.Optional(Type.Union([Type.Number(), Type.String()])),
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
    stale: Type.Optional(Type.Union([Type.Number(), Type.String()])),
    minzoom: Type.Optional(Type.Union([Type.Number(), Type.String()])),
    maxzoom: Type.Optional(Type.Union([Type.Number(), Type.String()])),
    links: Type.Optional(Type.Array(StyleLink)),
});

export const StyleSingle = Type.Object({
    id: Type.Optional(Type.String()),
    remarks: Type.Optional(Type.String()),
    callsign: Type.Optional(Type.String()),
    stale: Type.Optional(Type.Union([Type.Number(), Type.String()])),
    minzoom: Type.Optional(Type.Union([Type.Number(), Type.String()])),
    maxzoom: Type.Optional(Type.Union([Type.Number(), Type.String()])),
    links: Type.Optional(Type.Array(StyleLink)),
    line: Type.Optional(StyleLine),
    point: Type.Optional(StylePoint),
    polygon: Type.Optional(StylePolygon)
})

export const StyleSingleContainer = Type.Object({
    query: Type.String(),

    delete: Type.Optional(Type.Boolean()),

    styles: Type.Optional(StyleSingle)
})

export const StyleContainer = Type.Object({
    line: Type.Optional(StyleLine),
    point: Type.Optional(StylePoint),
    polygon: Type.Optional(StylePolygon),
    id: Type.Optional(Type.String()),
    remarks: Type.Optional(Type.String()),
    callsign: Type.Optional(Type.String()),
    stale: Type.Optional(Type.Union([Type.Number(), Type.String()])),
    minzoom: Type.Optional(Type.Union([Type.Number(), Type.String()])),
    maxzoom: Type.Optional(Type.Union([Type.Number(), Type.String()])),
    links: Type.Optional(Type.Array(StyleLink)),
    queries: Type.Optional(Type.Array(StyleSingleContainer))
})

export interface StyleInterface {
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

    /**
     * Validate a Style Object to ensure it conforms to expected templates
     */
    static validate(styles: Static<typeof StyleContainer>) {
        try {
            this.#validateTemplate(styles);

            if (styles.queries) {
                for (const q of styles.queries) {
                    jsonata(q.query);

                    if (q.styles) {
                        this.#validateTemplate(q.styles);
                    }
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

    static #validateTemplate(style: Static<typeof StyleSingle>) {
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

        this.#validateZoom(style.minzoom, style.maxzoom);

        if (style.links) {
            this.#validateLinks(style.links);
        }

        if (style.point) this.#validateTemplateGeometry(style.point, 'point');
        if (style.polygon) this.#validateTemplateGeometry(style.polygon, 'polygon');
        if (style.line) this.#validateTemplateGeometry(style.line, 'line');
    }

    static #validateTemplateGeometry(style: validateStyleGeometry, type: string) {
        if (style.links) this.#validateLinks(style.links);

        this.#validateZoom(style.minzoom, style.maxzoom);

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

    static #validateZoom(minzoom?: number | string, maxzoom?: number | string) {
        if (minzoom !== undefined && typeof minzoom === 'number') {
            if (minzoom < 0) {
                throw new Err(400, null, `Invalid minzoom: ${minzoom} - Less than 0`);
            } else if (minzoom > 24) {
                throw new Err(400, null, `Invalid minzoom: ${minzoom} - Greater than 24`);
            }
        } else if (typeof minzoom === 'string') {
            try {
                handlebars.compile(minzoom)({});
            } catch (err) {
                throw new Err(400, err instanceof Error ? err : new Error(String(err)), `Invalid MinZoom: ${minzoom}`)
            }
        }

        if (maxzoom !== undefined && typeof maxzoom === 'number') {
            if (maxzoom < 0) {
                throw new Err(400, null, `Invalid maxzoom: ${maxzoom} - Less than 0`);
            } else if (maxzoom > 24) {
                throw new Err(400, null, `Invalid maxzoom: ${maxzoom} - Greater than 24`);
            }
        } else if (typeof maxzoom === 'string') {
            try {
                handlebars.compile(maxzoom)({});
            } catch (err) {
                throw new Err(400, err instanceof Error ? err : new Error(String(err)), `Invalid MaxZoom: ${minzoom}`)
            }
        }

        if (minzoom !== undefined && maxzoom !== undefined && typeof minzoom === 'number' && typeof maxzoom === 'number') {
            if (minzoom > maxzoom) {
                throw new Err(400, null, `Invalid zoom levels: minzoom ${minzoom} greater than maxzoom ${maxzoom}`);
            }
        }

    };

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
    compile(template: string, props: { [x: string]: unknown; }) {
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
    async feat(
        feature: Static<typeof Feature.InputFeature>
    ): Promise<null | Static<typeof Feature.InputFeature>> {
        try {
            if (!feature.properties) feature.properties = {};

            if (!this.style.enabled_styles) return feature;
            if (!feature.properties.metadata) feature.properties.metadata = {};

            // Properties that support Templating
            if (this.style.styles.id) feature.id = this.compile(this.style.styles.id, feature.properties.metadata);
            if (this.style.styles.callsign) feature.properties.callsign = this.compile(this.style.styles.callsign, feature.properties.metadata);
            if (this.style.styles.remarks) feature.properties.remarks = this.compile(this.style.styles.remarks, feature.properties.metadata);

            if (this.style.styles.maxzoom !== undefined) feature.properties.maxzoom = this.#numberTemplateString(feature, this.style.styles.maxzoom, feature.properties.maxzoom);
            if (this.style.styles.minzoom !== undefined) feature.properties.minzoom = this.#numberTemplateString(feature, this.style.styles.minzoom, feature.properties.minzoom);

            if (typeof this.style.styles.stale === 'string') {
                if (!isNaN(Number(this.style.styles.stale))) {
                    feature.properties.stale = Number(this.style.styles.stale) * 1000;
                } else {
                    feature.properties.stale = this.compile(this.style.styles.stale, feature.properties.metadata);
                }
            } else if (typeof this.style.styles.stale === 'number') {
                feature.properties.stale = this.style.styles.stale * 1000;
            }

            if (this.style.styles.links) {
                this.#links(this.style.styles.links, feature);
            }

            this.#by_geom(this.style.styles, feature);

            if (!this.style.styles.queries) {
                this.style.styles.queries = [];
            }

            for (const q of this.style.styles.queries) {
                try {
                    const expression = jsonata(q.query);

                    if (await expression.evaluate(feature) === true) {
                        if (q.delete === true) return null;

                        if (q.styles) {
                            if (q.styles.id) feature.id = this.compile(q.styles.id, feature.properties.metadata);
                            if (q.styles.callsign) feature.properties.callsign = this.compile(q.styles.callsign, feature.properties.metadata);
                            if (q.styles.remarks) feature.properties.remarks = this.compile(q.styles.remarks, feature.properties.metadata);
                            if (q.styles.links) this.#links(q.styles.links, feature);

                            if (q.styles.maxzoom !== undefined) feature.properties.maxzoom = this.#numberTemplateString(feature, q.styles.maxzoom, feature.properties.maxzoom);
                            if (q.styles.minzoom !== undefined) feature.properties.minzoom = this.#numberTemplateString(feature, q.styles.minzoom, feature.properties.minzoom);

                            if (typeof q.styles.stale === 'string') {
                                if (!isNaN(Number(q.styles.stale))) {
                                    feature.properties.stale = Number(q.styles.stale) * 1000;
                                } else {
                                    feature.properties.stale = this.compile(q.styles.stale, feature.properties.metadata);
                                }
                            } else if (typeof q.styles.stale === 'number') {
                                feature.properties.stale = q.styles.stale * 1000;
                            }

                            this.#by_geom(q.styles, feature);
                        }
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

    #numberTemplateString(
        feature: Static<typeof Feature.InputFeature>,
        value: string | number,
        existing: number | undefined
    ): number | undefined {
        if (typeof value === 'string') {
            if (!isNaN(Number(value))) {
                return Number(value);
            } else {
                const comp = this.compile(value, feature.properties.metadata || {});

                if (!isNaN(Number(comp))) {
                    return Number(comp);
                } else {
                    return existing;
                }
            }
        } else if (typeof value === 'number') {
            return value;
        }
    }

    #links(links: Array<Static<typeof StyleLink>>, feature: Static<typeof Feature.InputFeature>) {
        if (!feature.properties) feature.properties = {};
        if (!feature.properties.metadata) feature.properties.metadata = {};
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
        if (!feature.properties.metadata) feature.properties.metadata = {};

        if (feature.geometry.type === 'Point' && style.point) {
            if (style.point.id) feature.id = this.compile(style.point.id, feature.properties.metadata);
            if (style.point.type) feature.properties.type = this.compile(style.point.type, feature.properties.metadata);
            if (style.point.remarks) feature.properties.remarks = this.compile(style.point.remarks, feature.properties.metadata);
            if (style.point.callsign) feature.properties.callsign = this.compile(style.point.callsign, feature.properties.metadata);
            if (style.point.links) this.#links(style.point.links, feature);

            if (style.point.maxzoom !== undefined) feature.properties.maxzoom = this.#numberTemplateString(feature, style.point.maxzoom, feature.properties.maxzoom);
            if (style.point.minzoom !== undefined) feature.properties.minzoom = this.#numberTemplateString(feature, style.point.minzoom, feature.properties.minzoom);

            if (typeof style.point.stale === 'string') {
                if (!isNaN(Number(style.point.stale))) {
                    feature.properties.stale = Number(style.point.stale) * 1000;
                } else {
                    feature.properties.stale = this.compile(style.point.stale, feature.properties.metadata);
                }
            } else if (typeof style.point.stale === 'number') {
                feature.properties.stale = style.point.stale * 1000;
            }

            if (style.point['marker-color']) feature.properties['marker-color'] = style.point['marker-color'];
            if (style.point['marker-opacity']) feature.properties['marker-opacity'] = Number(style.point['marker-opacity']);
            if (style.point.icon) feature.properties.icon = style.point.icon;
        } else if (feature.geometry.type === 'LineString' && style.line) {
            if (style.line.id) feature.id = this.compile(style.line.id, feature.properties.metadata);
            if (style.line.remarks) feature.properties.remarks = this.compile(style.line.remarks, feature.properties.metadata);
            if (style.line.callsign) feature.properties.callsign = this.compile(style.line.callsign, feature.properties.metadata);
            if (style.line.links) this.#links(style.line.links, feature);

            if (style.line.maxzoom !== undefined) feature.properties.maxzoom = this.#numberTemplateString(feature, style.line.maxzoom, feature.properties.maxzoom);
            if (style.line.minzoom !== undefined) feature.properties.minzoom = this.#numberTemplateString(feature, style.line.minzoom, feature.properties.minzoom);

            if (typeof style.line.stale === 'string') {
                if (!isNaN(Number(style.line.stale))) {
                    feature.properties.stale = Number(style.line.stale) * 1000;
                } else {
                    feature.properties.stale = this.compile(style.line.stale, feature.properties.metadata);
                }
            } else if (typeof style.line.stale === 'number') {
                feature.properties.stale = style.line.stale * 1000;
            }

            if (style.line.stroke) feature.properties.stroke = style.line.stroke;
            if (style.line['stroke-style']) feature.properties['stroke-style'] = style.line['stroke-style'];
            if (style.line['stroke-opacity']) feature.properties['stroke-opacity'] = Number(style.line['stroke-opacity']);
            if (style.line['stroke-width']) feature.properties['stroke-width'] = Number(style.line['stroke-width']);
        } else if (feature.geometry.type === 'Polygon' && style.polygon) {
            if (style.polygon.id) feature.id = this.compile(style.polygon.id, feature.properties.metadata);
            if (style.polygon.remarks) feature.properties.remarks = this.compile(style.polygon.remarks, feature.properties.metadata);
            if (style.polygon.callsign) feature.properties.callsign = this.compile(style.polygon.callsign, feature.properties.metadata);
            if (style.polygon.links) this.#links(style.polygon.links, feature);

            if (style.polygon.maxzoom !== undefined) feature.properties.maxzoom = this.#numberTemplateString(feature, style.polygon.maxzoom, feature.properties.maxzoom);
            if (style.polygon.minzoom !== undefined) feature.properties.minzoom = this.#numberTemplateString(feature, style.polygon.minzoom, feature.properties.minzoom);

            if (typeof style.polygon.stale === 'string') {
                if (!isNaN(Number(style.polygon.stale))) {
                    feature.properties.stale = Number(style.polygon.stale) * 1000;
                } else {
                    feature.properties.stale = this.compile(style.polygon.stale, feature.properties.metadata);
                }
            } else if (typeof style.polygon.stale === 'number') {
                feature.properties.stale = style.polygon.stale * 1000;
            }

            if (style.polygon.stroke) feature.properties.stroke = style.polygon.stroke;
            if (style.polygon['stroke-style']) feature.properties['stroke-style'] = style.polygon['stroke-style'];
            if (style.polygon['stroke-opacity']) feature.properties['stroke-opacity'] = Number(style.polygon['stroke-opacity']);
            if (style.polygon['stroke-width']) feature.properties['stroke-width'] = Number(style.polygon['stroke-width']);

            if (style.polygon.fill) feature.properties.fill = style.polygon.fill;
            if (style.polygon['fill-opacity']) feature.properties['fill-opacity'] = Number(style.polygon['fill-opacity']);
        }
    }
}

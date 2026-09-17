import type { Static, TObject } from '@sinclair/typebox';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import jsonata from 'jsonata';
import Err from '@openaddresses/batch-error';
import type { Feature } from '@tak-ps/node-cot';
import handlebars from './handlebars.js';
import type { CoreEvent, CoreDevice, LayerMapping } from './schema.js';
import { LayerMapping_Destination } from './enums.js';
import { CoreEventSchema, CoreDeviceSchema } from './core-schema.js';

/** A submitted Feature - the geometry is optional as CoreEvent & CoreDevice Maps do not require one */
export type MappingFeature = Omit<Static<typeof Feature.InputFeature>, 'geometry'> & {
    geometry?: Static<typeof Feature.InputFeature>['geometry'] | null;
};

export type MappingRow = Pick<InferSelectModel<typeof LayerMapping>, 'destination' | 'query' | 'mapping'>;

export type MappedEvent = Partial<Pick<InferInsertModel<typeof CoreEvent>, keyof Static<typeof CoreEventSchema>>>;
export type MappedDevice = Partial<Pick<InferInsertModel<typeof CoreDevice>, keyof Static<typeof CoreDeviceSchema>>>;

/**
 * - template:  Handlebars template rendered against the Feature metadata
 * - number:    Number, or a template rendering to a number
 * - seconds:   Seconds as a number, or a template rendering to seconds or a timestamp
 * - timestamp: Template rendering to a date-time - an empty result clears the value
 * - links:     Array of { url, remarks } templates appended as CoT links
 * - array:     Non-empty array copied as-is
 */
export type MapFieldKind = 'template' | 'number' | 'boolean' | 'enum' | 'seconds' | 'timestamp' | 'links' | 'array';

export interface MapField {
    /** Dot path of the value in the Map object */
    key: string;
    kind: MapFieldKind;
    /** Dot path the value is written to on the output object */
    target: string;
    /** Only applied to Features of this geometry type */
    geometry?: 'Point' | 'LineString' | 'Polygon';
    options?: string[];
    min?: number;
    max?: number;
}

type Render = {
    field: MapField;
    feature: MappingFeature;
    target: Record<string, unknown>;
    compile: (template: string) => string;
};

function prop(key: string, kind: MapFieldKind, extra: Partial<MapField> = {}): MapField {
    return { key, kind, target: `properties.${key}`, ...extra };
}

/** Fields of a flat JSON Schema - the kind of each is derived from its property definition */
function schemaFields(schema: TObject): MapField[] {
    return Object.entries(schema.properties).map(([key, property]) => {
        let kind: MapFieldKind = 'template';
        if (property.type === 'boolean') kind = 'boolean';
        else if (property.type === 'number' || property.type === 'integer') kind = 'number';
        else if (property.enum) kind = 'enum';
        else if (property.format === 'date-time') kind = 'timestamp';

        return { key, kind, target: key, options: property.enum, min: property.minimum, max: property.maximum };
    });
}

/** Fields shared by the top level of a CoreFeature Map and each of its geometry blocks */
const FEATURE_COMMON: MapField[] = [
    { key: 'id', kind: 'template', target: 'id' },
    prop('callsign', 'template'),
    prop('remarks', 'template'),
    prop('phone', 'template', { target: 'properties.contact.phone' }),
    prop('stale', 'seconds'),
    prop('minzoom', 'number', { min: 0, max: 24 }),
    prop('maxzoom', 'number', { min: 0, max: 24 }),
    prop('links', 'links'),
    prop('marti.archive', 'boolean', { target: 'properties.marti_archive' }),
    prop('marti.dest', 'array', { target: 'properties.dest' }),
];

function geometryBlock(block: string, geometry: MapField['geometry'], extra: MapField[]): MapField[] {
    return [...FEATURE_COMMON, ...extra].map(field => ({
        ...field,
        key: `${block}.${field.key}`,
        geometry,
    }));
}

const STROKE: MapField[] = [
    prop('stroke', 'template'),
    prop('stroke-style', 'template'),
    prop('stroke-opacity', 'number'),
    prop('stroke-width', 'number'),
];

export const MAP_FIELDS: Record<LayerMapping_Destination, MapField[]> = {
    [LayerMapping_Destination.COREFEATURE]: [
        ...FEATURE_COMMON,
        ...geometryBlock('point', 'Point', [
            prop('type', 'template'),
            prop('marker-color', 'template'),
            prop('marker-opacity', 'number'),
            prop('rotate', 'boolean'),
            prop('icon', 'template'),
        ]),
        ...geometryBlock('line', 'LineString', [
            prop('type', 'enum', { options: ['u-d-f', 'b-m-r'] }),
            ...STROKE,
        ]),
        ...geometryBlock('polygon', 'Polygon', [
            ...STROKE,
            prop('fill', 'template'),
            prop('fill-opacity', 'number'),
        ]),
    ],
    [LayerMapping_Destination.COREEVENT]: schemaFields(CoreEventSchema),
    [LayerMapping_Destination.COREDEVICE]: schemaFields(CoreDeviceSchema),
};

function getPath(obj: unknown, path: string): unknown {
    let current: unknown = obj;
    for (const part of path.split('.')) {
        if (current === null || typeof current !== 'object') return undefined;
        current = (current as Record<string, unknown>)[part];
    }
    return current;
}

function setPath(obj: Record<string, unknown>, path: string, value: unknown): void {
    const parts = path.split('.');
    let current = obj;
    for (const part of parts.slice(0, -1)) {
        if (current[part] === null || typeof current[part] !== 'object') current[part] = {};
        current = current[part] as Record<string, unknown>;
    }
    current[parts[parts.length - 1]] = value;
}

function label(field: MapField): string {
    const parts = field.key.split('.');
    const name = parts[parts.length - 1]
        .replace(/[_-]/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase())
        .replace(/\bId\b/, 'ID');

    return parts.length > 1 ? `(${parts.slice(0, -1).join('.')}) ${name}` : name;
}

function isEmpty(value: unknown): boolean {
    return value === undefined || value === null || value === '';
}

function isNumeric(value: unknown): boolean {
    return typeof value === 'number' || (typeof value === 'string' && value.trim() !== '' && !isNaN(Number(value)));
}

function invalid(err: unknown, message: string): Err {
    return new Err(400, err instanceof Error ? err : new Error(String(err)), message);
}

function assertTemplate(value: unknown, message: string): void {
    if (typeof value !== 'string') throw invalid(null, message);

    try {
        handlebars.compile(value)({});
    } catch (err) {
        throw invalid(err, message);
    }
}

/** A number, a numeric string or a template rendering to one */
function renderNumber(raw: unknown, compile: Render['compile']): number | undefined {
    if (isNumeric(raw)) return Number(raw);
    if (typeof raw !== 'string') return undefined;

    const rendered = compile(raw);
    return isNumeric(rendered) ? Number(rendered) : undefined;
}

/** How each kind validates a Map value & renders it for a Feature - undefined leaves the target untouched */
const KINDS: Record<MapFieldKind, {
    validate: (value: unknown, field: MapField, name: string) => void;
    render: (raw: unknown, ctx: Render) => unknown;
}> = {
    template: {
        validate: (value, field, name) => assertTemplate(value, `Invalid ${name} Template: ${value}`),
        render: (raw, { compile }) => typeof raw === 'string' ? compile(raw) : undefined,
    },
    number: {
        validate: (value, field, name) => {
            if (isNumeric(value)) {
                if (field.min !== undefined && Number(value) < field.min) throw invalid(null, `Invalid ${name}: ${value} - Less than ${field.min}`);
                if (field.max !== undefined && Number(value) > field.max) throw invalid(null, `Invalid ${name}: ${value} - Greater than ${field.max}`);
            } else if (typeof value === 'string') {
                assertTemplate(value, `Invalid ${name} Template: ${value}`);
            } else {
                throw invalid(null, `Invalid ${name}: ${value} - Expected a number`);
            }
        },
        render: (raw, { field, compile }) => {
            const number = renderNumber(raw, compile);
            if (number === undefined) return undefined;
            if (field.min !== undefined && number < field.min) return undefined;
            if (field.max !== undefined && number > field.max) return undefined;

            return number;
        },
    },
    seconds: {
        validate: (value, field, name) => KINDS.number.validate(value, field, name),
        render: (raw, { compile }) => {
            const seconds = renderNumber(raw, compile);
            if (seconds !== undefined) return seconds * 1000;

            return typeof raw === 'string' ? compile(raw).trim() || undefined : undefined;
        },
    },
    timestamp: {
        validate: (value, field, name) => assertTemplate(value, `Invalid ${name} Template: ${value}`),
        render: (raw, { compile }) => {
            if (typeof raw !== 'string') return undefined;

            const rendered = compile(raw).trim();
            if (!rendered) return null;

            return isNaN(new Date(rendered).getTime()) ? undefined : new Date(rendered).toISOString();
        },
    },
    boolean: {
        validate: (value, field, name) => {
            if (typeof value !== 'boolean' && value !== 'true' && value !== 'false') {
                throw invalid(null, `Invalid ${name}: ${value} - Expected a boolean`);
            }
        },
        render: (raw) => {
            if (typeof raw === 'boolean') return raw;
            return raw === 'true' || raw === 'false' ? raw === 'true' : undefined;
        },
    },
    enum: {
        validate: (value, field, name) => {
            if (typeof value !== 'string' || !field.options?.includes(value)) {
                throw invalid(null, `Invalid ${name}: ${value} - Expected one of ${field.options?.join(', ')}`);
            }
        },
        render: (raw, { field }) => typeof raw === 'string' && field.options?.includes(raw) ? raw : undefined,
    },
    links: {
        validate: (value, field, name) => {
            if (!Array.isArray(value)) throw invalid(null, `Invalid ${name}: Expected an array`);

            for (const link of value) {
                assertTemplate(link?.url, `Invalid Link URL: ${link?.url}`);
                assertTemplate(link?.remarks, `Invalid Link Remarks: ${link?.remarks}`);
            }
        },
        render: (raw, { field, feature, target, compile }) => {
            if (!Array.isArray(raw)) return undefined;

            const existing = getPath(target, field.target);

            return [
                ...(Array.isArray(existing) ? existing : []),
                ...raw.map(link => ({
                    uid: feature.id,
                    relation: 'r-u',
                    mime: 'text/html',
                    url: compile(String(link.url ?? '')),
                    remarks: compile(String(link.remarks ?? '')),
                })),
            ];
        },
    },
    array: {
        validate: (value, field, name) => {
            if (!Array.isArray(value)) throw invalid(null, `Invalid ${name}: Expected an array`);
        },
        render: raw => Array.isArray(raw) && raw.length ? raw : undefined,
    },
};

/**
 * Convert submitted Features with the Layer Mappings of a named Output schema
 *
 * A Feature is converted by at most one Mapping per destination - each
 * destination is described by a list of MapFields which the engine walks,
 * rendering templates against `properties.metadata` and writing the result to
 * the field's target
 */
export default class Mapping {
    rows: MappingRow[];
    templates: Map<string, HandlebarsTemplateDelegate>;
    expressions: Map<string, jsonata.Expression>;

    constructor(rows: MappingRow[]) {
        this.rows = rows;
        this.templates = new Map();
        this.expressions = new Map();
    }

    /**
     * Validate a Map object against the fields of its destination
     */
    static validate(destination: LayerMapping_Destination, map: Record<string, unknown>): true {
        for (const field of MAP_FIELDS[destination]) {
            const value = getPath(map, field.key);
            if (!isEmpty(value)) KINDS[field.kind].validate(value, field, label(field));
        }

        for (const block of ['', 'point.', 'line.', 'polygon.']) {
            const minzoom = getPath(map, `${block}minzoom`);
            const maxzoom = getPath(map, `${block}maxzoom`);
            if (typeof minzoom === 'number' && typeof maxzoom === 'number' && minzoom > maxzoom) {
                throw invalid(null, `Invalid zoom levels: minzoom ${minzoom} greater than maxzoom ${maxzoom}`);
            }
        }

        return true;
    }

    /**
     * The single Mapping of a destination that applies to a Feature - queries
     * are mutually exclusive, the first matching query in insertion order wins
     * and the default (null query) Mapping only applies when no query matched
     */
    async match(destination: LayerMapping_Destination, feature: MappingFeature): Promise<MappingRow | null> {
        const rows = this.rows.filter(row => row.destination === destination);

        for (const row of rows) {
            if (row.query !== null && await this.#matches(row.query, feature)) return row;
        }

        return rows.find(row => row.query === null) ?? null;
    }

    /**
     * Render a Mapping against a Feature - a CoreFeature Mapping styles the
     * Feature in place, other destinations produce the fields of a new record
     */
    render(row: MappingRow, feature: MappingFeature): Record<string, unknown> {
        if (!feature.properties) feature.properties = {};
        if (!feature.properties.metadata) feature.properties.metadata = {};

        const metadata = feature.properties.metadata;
        const compile = (template: string) => this.compile(template, metadata);

        const target: Record<string, unknown> = row.destination === LayerMapping_Destination.COREFEATURE
            ? feature as unknown as Record<string, unknown>
            : {};

        try {
            for (const field of MAP_FIELDS[row.destination]) {
                if (field.geometry && feature.geometry?.type !== field.geometry) continue;

                const raw = getPath(row.mapping, field.key);
                if (isEmpty(raw)) continue;

                const value = KINDS[field.kind].render(raw, { field, feature, target, compile });
                if (value !== undefined) setPath(target, field.target, value);
            }
        } catch (err) {
            if (err instanceof Err) throw err;
            throw invalid(err, err instanceof Error ? err.message : String(err));
        }

        return target;
    }

    async #matches(query: string, feature: MappingFeature): Promise<boolean> {
        try {
            let expression = this.expressions.get(query);
            if (!expression) {
                expression = jsonata(query);
                this.expressions.set(query, expression);
            }

            return await expression.evaluate(feature) === true;
        } catch {
            // Queries that fail to evaluate against a Feature simply don't match
            return false;
        }
    }

    /**
     * Compile and run a template or use a cached template for performance
     */
    compile(template: string, props: Record<string, unknown>): string {
        let t = this.templates.get(template);
        if (!t) {
            t = handlebars.compile(template, { noEscape: true });
            this.templates.set(template, t);
        }

        return t(props);
    }
}
